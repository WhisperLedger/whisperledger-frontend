import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { collection, doc, setDoc } from "firebase/firestore";

import type { CategoryId, PaymentMode } from "@/context/ExpenseContext";
import { db } from "@/lib/firebase";

export const SMS_APPROVAL_CATEGORY = "sms_approval";
export const DAILY_REMINDER_TYPE = "daily_reminder";
export const SMS_APPROVAL_TYPE = "sms_approval";
const DAILY_REMINDER_NOTIFICATION_ID_KEY = "@daily_reminder_notification_id";
const PENDING_SMS_APPROVAL_IDS_KEY = "@pending_sms_approval_ids";
const PROCESSED_SMS_APPROVAL_IDS_KEY = "@processed_sms_approval_ids";

export enum SMSAction {
  APPROVE = "approve",
  DISCARD = "discard",
}

export type SMSApprovalPayload = {
  amount: number;
  merchant: string;
  smsId: string;
  date: string;
  categoryId: CategoryId;
  paymentMode: PaymentMode;
  note: string;
};

async function readStringSet(key: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

async function writeStringSet(key: string, values: Set<string>) {
  await AsyncStorage.setItem(key, JSON.stringify(Array.from(values)));
}

export async function hasSMSApprovalBeenQueuedOrProcessed(smsId?: string | null): Promise<boolean> {
  if (!smsId) return false;
  const [pending, processed] = await Promise.all([
    readStringSet(PENDING_SMS_APPROVAL_IDS_KEY),
    readStringSet(PROCESSED_SMS_APPROVAL_IDS_KEY),
  ]);
  return pending.has(smsId) || processed.has(smsId);
}

export async function markSMSApprovalProcessed(smsId?: string | null) {
  if (!smsId) return;
  const [pending, processed] = await Promise.all([
    readStringSet(PENDING_SMS_APPROVAL_IDS_KEY),
    readStringSet(PROCESSED_SMS_APPROVAL_IDS_KEY),
  ]);
  pending.delete(smsId);
  processed.add(smsId);
  await Promise.all([
    writeStringSet(PENDING_SMS_APPROVAL_IDS_KEY, pending),
    writeStringSet(PROCESSED_SMS_APPROVAL_IDS_KEY, processed),
  ]);
}

function getNotificationsModule() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("expo-notifications");
  } catch {
    return null;
  }
}

export async function setupNotifications() {
  const Notifications = getNotificationsModule();
  if (!Notifications) return;

  await Notifications.setNotificationCategoryAsync(SMS_APPROVAL_CATEGORY, [
    {
      identifier: SMSAction.APPROVE,
      buttonTitle: "Approve",
      options: { opensAppToForeground: true },
    },
    {
      identifier: SMSAction.DISCARD,
      buttonTitle: "Discard",
      options: { opensAppToForeground: true, isDestructive: true },
    },
  ]);

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#4f46e5",
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      showBadge: true,
      enableVibrate: true,
      enableLights: true,
    });
    await Notifications.setNotificationChannelAsync("budget_alerts", {
      name: "Budget Alerts",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 300, 200, 300],
      lightColor: "#f59e0b",
      description: "Alerts when you approach or exceed a category budget limit",
    });
  }
}

export async function requestNotificationPermissions() {
  const Notifications = getNotificationsModule();
  if (!Notifications) return false;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  return finalStatus === "granted";
}

export async function scheduleSMSApprovalNotification(transaction: SMSApprovalPayload) {
  const Notifications = getNotificationsModule();
  if (!Notifications) return null;

  if (await hasSMSApprovalBeenQueuedOrProcessed(transaction.smsId)) return null;

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: "New Transaction Detected",
      body: `Spent Rs ${transaction.amount} at ${transaction.merchant}. Approve?`,
      categoryIdentifier: SMS_APPROVAL_CATEGORY,
      data: {
        ...transaction,
        notificationType: SMS_APPROVAL_TYPE,
        isLocalOnly: true,
        smsApproval: true,
      },
      sound: true,
      priority: "high",
      channelId: "default",
    },
    trigger: null,
  });

  const pending = await readStringSet(PENDING_SMS_APPROVAL_IDS_KEY);
  pending.add(transaction.smsId);
  await writeStringSet(PENDING_SMS_APPROVAL_IDS_KEY, pending);

  return notificationId;
}

export async function scheduleDailyExpenseReminder(hour: number, minute: number) {
  const Notifications = getNotificationsModule();
  if (!Notifications) return null;

  const existingId = await AsyncStorage.getItem(DAILY_REMINDER_NOTIFICATION_ID_KEY);
  if (existingId) {
    await Notifications.cancelScheduledNotificationAsync(existingId).catch(() => null);
  }

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Time to log your expenses",
      body: "Tap to quickly add today's spends.",
      data: {
        notificationType: DAILY_REMINDER_TYPE,
        deepLink: "/(tabs)/index?openAdd=1",
        openAdd: true,
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });

  await AsyncStorage.setItem(DAILY_REMINDER_NOTIFICATION_ID_KEY, id);
  return id;
}

export async function logUserNotification(params: {
  userId: string;
  notificationId: string;
  title: string;
  body: string;
  notificationType: string;
  data?: Record<string, any>;
  read?: boolean;
}) {
  const ref = doc(collection(db, `users/${params.userId}/notifications`), params.notificationId);
  await setDoc(
    ref,
    {
      title: params.title,
      body: params.body,
      notificationType: params.notificationType,
      data: params.data || {},
      read: params.read ?? false,
      createdAt: Date.now(),
    },
    { merge: true }
  );
}

/**
 * Sends a push notification when a budget threshold is crossed.
 * Called automatically by BudgetContext when spending hits 50%, 80%, or 100%.
 */
export async function sendBudgetAlert(
  categoryName: string,
  percentage: number,
  remaining: number,
  limit: number
): Promise<void> {
  const Notifications = getNotificationsModule();
  if (!Notifications) return;

  const emoji = percentage >= 100 ? "🚨" : percentage >= 80 ? "⚠️" : "💡";
  const title =
    percentage >= 100
      ? `${emoji} Budget Exceeded: ${categoryName}`
      : `${emoji} Budget Alert: ${categoryName}`;

  const body =
    percentage >= 100
      ? `You have exceeded your ₹${limit.toLocaleString("en-IN")} budget for ${categoryName}.`
      : `You've used ${Math.round(percentage)}% of your ${categoryName} budget. ₹${remaining.toLocaleString("en-IN")} remaining.`;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: {
          notificationType: "budget_alert",
          deepLink: "/(tabs)/analytics?tab=budgets",
          category: categoryName,
          percentage,
          remaining,
          limit,
        },
        sound: true,
        priority: "high",
        channelId: "budget_alerts",
      },
      trigger: null,
    });
  } catch (e) {
    console.warn("[Notifications] Budget alert failed:", e);
  }
}
