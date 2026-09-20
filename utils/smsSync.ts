import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import type { Expense, PaymentMode } from "@/context/ExpenseContext";
import {
  getNativePendingSMSApprovals,
  hasSMSApprovalBeenQueuedOrProcessed,
  markSMSApprovalProcessed,
  scheduleSMSApprovalNotification,
} from "@/utils/notifications";
import {
  classifyCategory,
  fetchAndParseSMS,
  hasSmsPermission,
  isSmsAutoSyncAvailable,
  type ParsedSMS,
} from "@/utils/smsParser";

const AUTO_SYNC_ENABLED_KEY = "@auto_sync_enabled";
const LAST_SMS_SYNC_TIME_KEY = "@last_sms_sync_time";
const DELETED_SMS_IDS_KEY = "@deleted_sms_ids";
const DEFAULT_LOOKBACK_DAYS = 7;
const INITIAL_LOOKBACK_DAYS = 30;

export const SMS_BACKGROUND_SYNC_TASK = "whisperledger-sms-background-sync";

type SyncOptions = {
  userId?: string;
  existingExpenses?: Expense[];
  initialLookback?: boolean;
};

type SyncResult = {
  parsed: number;
  queued: number;
  skipped: number;
};

let isSyncingSMS = false;

export async function syncNativePendingApprovals(): Promise<ParsedSMS[]> {
  if (Platform.OS !== "android") return [];
  try {
    const nativeList = await getNativePendingSMSApprovals();
    if (!Array.isArray(nativeList) || nativeList.length === 0) return [];

    return nativeList.map((item: any) => ({
      amount: Number(item.amount || 0),
      merchant: String(item.merchant || "Unknown Merchant"),
      date: String(item.date || new Date().toISOString().split("T")[0]),
      categoryId: classifyCategory(String(item.merchant || "")),
      paymentMode: "none" as PaymentMode,
      note: `Auto-synced: ${item.merchant || "Transaction"}`,
      smsId: String(item.smsId || `sms_${item.timestamp || Date.now()}_${item.amount}`),
    }));
  } catch {
    return [];
  }
}

async function readStringSet(key: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

async function addStringToSet(key: string, value: string) {
  const values = await readStringSet(key);
  values.add(value);
  await AsyncStorage.setItem(key, JSON.stringify(Array.from(values)));
}

async function getCachedUserId() {
  try {
    const raw = await AsyncStorage.getItem("@last_active_user_session");
    const parsed = raw ? JSON.parse(raw) : null;
    return typeof parsed?.uid === "string" ? parsed.uid : undefined;
  } catch {
    return undefined;
  }
}

async function getCachedExpenseSmsIds(userId?: string) {
  if (!userId) return new Set<string>();

  try {
    const raw = await AsyncStorage.getItem(`@expenses_${userId}`);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return new Set<string>();
    return new Set(
      parsed
        .map((expense) => expense?.smsId)
        .filter((smsId): smsId is string => typeof smsId === "string" && smsId.length > 0)
    );
  } catch {
    return new Set<string>();
  }
}

async function getMinDateMs(initialLookback?: boolean) {
  const lastSyncStr = await AsyncStorage.getItem(LAST_SMS_SYNC_TIME_KEY);
  const fallbackDays = initialLookback ? INITIAL_LOOKBACK_DAYS : DEFAULT_LOOKBACK_DAYS;
  const fallback = Date.now() - fallbackDays * 24 * 60 * 60 * 1000;

  if (!lastSyncStr) return fallback;

  const parsed = Number.parseInt(lastSyncStr, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function markSmsIgnored(smsId?: string | null) {
  if (!smsId) return;
  await addStringToSet(DELETED_SMS_IDS_KEY, smsId);
  await markSMSApprovalProcessed(smsId);
}

export async function queueSMSApprovalNotifications(options: SyncOptions = {}): Promise<SyncResult> {
  if (Platform.OS !== "android" || !isSmsAutoSyncAvailable()) {
    return { parsed: 0, queued: 0, skipped: 0 };
  }

  // Mutex lock to prevent duplicate parallel executions
  if (isSyncingSMS) {
    return { parsed: 0, queued: 0, skipped: 0 };
  }
  isSyncingSMS = true;

  try {
    const permissionGranted = await hasSmsPermission();
    if (!permissionGranted) {
      return { parsed: 0, queued: 0, skipped: 0 };
    }

    const minDateMs = await getMinDateMs(options.initialLookback);
    const parsedExpenses = await fetchAndParseSMS(minDateMs);
    if (parsedExpenses.length === 0) {
      return { parsed: 0, queued: 0, skipped: 0 };
    }

    const userId = options.userId || (await getCachedUserId());
    const deletedIds = await readStringSet(DELETED_SMS_IDS_KEY);
    const cachedSmsIds = await getCachedExpenseSmsIds(userId);
    const existingSmsIds = new Set<string>(cachedSmsIds);
    for (const expense of options.existingExpenses || []) {
      if (expense.smsId) existingSmsIds.add(expense.smsId);
    }

    let queued = 0;
    let skipped = 0;

    for (const expense of parsedExpenses) {
      if (!expense.smsId) {
        skipped += 1;
        continue;
      }

      if (deletedIds.has(expense.smsId) || existingSmsIds.has(expense.smsId)) {
        skipped += 1;
        continue;
      }

      // Check if an expense with the exact same amount and date already exists in the user's ledger
      const isAlreadyInLedger = (options.existingExpenses || []).some(
        (e) => e.date === expense.date && Math.abs(e.amount - expense.amount) < 0.01
      );

      if (isAlreadyInLedger) {
        if (expense.smsId) {
          await markSMSApprovalProcessed(expense.smsId);
        }
        skipped += 1;
        continue;
      }

      const dateAmountKey = `sms_${expense.date}_${String(expense.amount).replace(".", "_")}`;
      if (
        (await hasSMSApprovalBeenQueuedOrProcessed(expense.smsId)) ||
        (await hasSMSApprovalBeenQueuedOrProcessed(dateAmountKey))
      ) {
        skipped += 1;
        continue;
      }

      const notificationId = await scheduleSMSApprovalNotification(expense);
      if (notificationId) {
        queued += 1;
      } else {
        skipped += 1;
      }
    }

    await AsyncStorage.setItem(LAST_SMS_SYNC_TIME_KEY, Date.now().toString());

    return { parsed: parsedExpenses.length, queued, skipped };
  } finally {
    isSyncingSMS = false;
  }
}

function getBackgroundModules() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const TaskManager = require("expo-task-manager");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const BackgroundFetch = require("expo-background-fetch");
    return { TaskManager, BackgroundFetch };
  } catch {
    return null;
  }
}

function defineBackgroundTask() {
  const modules = getBackgroundModules();
  if (!modules) return null;

  const { TaskManager, BackgroundFetch } = modules;
  if (TaskManager.isTaskDefined?.(SMS_BACKGROUND_SYNC_TASK)) return modules;

  TaskManager.defineTask(SMS_BACKGROUND_SYNC_TASK, async () => {
    try {
      const enabled = await AsyncStorage.getItem(AUTO_SYNC_ENABLED_KEY);
      if (enabled !== "true") return BackgroundFetch.BackgroundFetchResult.NoData;

      const result = await queueSMSApprovalNotifications();
      return result.queued > 0
        ? BackgroundFetch.BackgroundFetchResult.NewData
        : BackgroundFetch.BackgroundFetchResult.NoData;
    } catch (error) {
      console.warn("[SMS Sync] Background sync failed:", error);
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });

  return modules;
}

export async function registerSMSBackgroundSync() {
  if (Platform.OS !== "android" || !isSmsAutoSyncAvailable()) return false;

  const modules = defineBackgroundTask();
  if (!modules) return false;

  const { TaskManager, BackgroundFetch } = modules;
  const enabled = await AsyncStorage.getItem(AUTO_SYNC_ENABLED_KEY);
  if (enabled !== "true") return false;

  if (!(await hasSmsPermission())) return false;

  const status = await BackgroundFetch.getStatusAsync();
  if (
    status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
    status === BackgroundFetch.BackgroundFetchStatus.Denied
  ) {
    return false;
  }

  const registered = await TaskManager.isTaskRegisteredAsync(SMS_BACKGROUND_SYNC_TASK);
  if (registered) return true;

  await BackgroundFetch.registerTaskAsync(SMS_BACKGROUND_SYNC_TASK, {
    minimumInterval: 15 * 60,
    stopOnTerminate: false,
    startOnBoot: true,
  });

  return true;
}

export async function unregisterSMSBackgroundSync() {
  const modules = getBackgroundModules();
  if (!modules) return;

  const registered = await modules.TaskManager.isTaskRegisteredAsync(SMS_BACKGROUND_SYNC_TASK);
  if (registered) {
    await modules.BackgroundFetch.unregisterTaskAsync(SMS_BACKGROUND_SYNC_TASK);
  }
}

defineBackgroundTask();
