import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import { NativeModules, Platform } from "react-native";
import { collection, doc, setDoc, updateDoc } from "firebase/firestore";

function getSmsBridge() {
  try {
    return NativeModules?.SmsBridge || null;
  } catch {
    return null;
  }
}

import type { CategoryId, PaymentMode } from "@/context/ExpenseContext";
import { db } from "@/lib/firebase";

export const SMS_APPROVAL_CATEGORY = "sms_approval";
export const DAILY_REMINDER_TYPE = "daily_reminder";
export const SMS_APPROVAL_TYPE = "sms_approval";
const DAILY_REMINDER_NOTIFICATION_ID_KEY = "@daily_reminder_notification_id";
const PENDING_SMS_APPROVAL_IDS_KEY = "@pending_sms_approval_ids";
const PROCESSED_SMS_APPROVAL_IDS_KEY = "@processed_sms_approval_ids";

const sentNotificationCooldownMap = new Map<string, number>();

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
  if (pending.has(smsId) || processed.has(smsId)) return true;

  const bridge = getSmsBridge();
  if (bridge?.isSmsSeen) {
    try {
      const seen = await bridge.isSmsSeen(smsId);
      if (seen) return true;
    } catch {
      // ignore
    }
  }

  return false;
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

  const bridge = getSmsBridge();
  if (bridge) {
    try {
      if (bridge.markSmsSeen) await bridge.markSmsSeen(smsId);
      if (bridge.clearPendingApproval) await bridge.clearPendingApproval(smsId);
    } catch {
      // ignore
    }
  }
}

export async function getNativePendingSMSApprovals(): Promise<any[]> {
  const bridge = getSmsBridge();
  if (Platform.OS !== "android" || !bridge?.getPendingApprovals) return [];
  try {
    const raw = await bridge.getPendingApprovals();
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function clearNativePendingSMSApproval(smsId: string): Promise<boolean> {
  const bridge = getSmsBridge();
  if (Platform.OS !== "android" || !bridge?.clearPendingApproval) return false;
  try {
    return await bridge.clearPendingApproval(smsId);
  } catch {
    return false;
  }
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
      // Financial notifications must not reveal amounts or merchants on a locked device.
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
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

/** Checks notification access without displaying a system prompt. Safe for background flows. */
export async function hasNotificationPermission() {
  const Notifications = getNotificationsModule();
  if (!Notifications) return false;
  const { status } = await Notifications.getPermissionsAsync();
  return status === "granted";
}

type PushRegistrationUser = { uid: string; name?: string; email?: string };

export async function persistExpoPushToken(user: PushRegistrationUser, token: string) {
  if (!token || !user.uid) return;
  await setDoc(doc(db, `users/${user.uid}`), {
    uid: user.uid,
    name: user.name || "User",
    email: user.email || "",
    pushToken: token,
    pushTokenPlatform: Platform.OS,
    pushTokenUpdatedAt: Date.now(),
    notificationPermission: "granted",
    lastActive: Date.now(),
  }, { merge: true });
}

export async function registerExpoPushToken(user: PushRegistrationUser): Promise<string | null> {
  if (!Device.isDevice || Platform.OS === "web") return null;
  const Notifications = getNotificationsModule();
  if (!Notifications) return null;

  await setupNotifications();
  const permission = await Notifications.getPermissionsAsync();
  const status = permission.status;

  if (status !== "granted") {
    await setDoc(doc(db, `users/${user.uid}`), {
      notificationPermission: status,
      pushTokenUpdatedAt: Date.now(),
    }, { merge: true }).catch(() => null);
    return null;
  }

  const projectId = Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;
  if (!projectId) throw new Error("Expo project ID is missing from app configuration.");

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await persistExpoPushToken(user, token);
  return token;
}

export async function scheduleSMSApprovalNotification(transaction: SMSApprovalPayload) {
  const Notifications = getNotificationsModule();
  if (!Notifications) return null;

  if (await hasSMSApprovalBeenQueuedOrProcessed(transaction.smsId)) return null;

  // Cross-check alternative normalized key (date + amount) against both JS and Native stores
  const normalizedAmount = String(transaction.amount).replace(".", "_");
  const dateAmountKey = `sms_${transaction.date}_${normalizedAmount}`;
  if (await hasSMSApprovalBeenQueuedOrProcessed(dateAmountKey)) return null;

  const bridge = getSmsBridge();
  if (bridge?.isSmsSeen) {
    try {
      const seenByNative =
        (await bridge.isSmsSeen(transaction.smsId)) ||
        (await bridge.isSmsSeen(dateAmountKey)) ||
        (await bridge.isSmsSeen(`seen_${transaction.smsId}`)) ||
        (await bridge.isSmsSeen(`seen_${dateAmountKey}`));
      if (seenByNative) {
        // Native broadcast receiver already posted notification in real-time, skip duplicate!
        return null;
      }
    } catch {
      // ignore
    }
  }

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
  pending.add(dateAmountKey);
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
        deepLink: "/?openAdd=1",
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

export async function dismissAndClearNotification(notificationId?: string | null, userId?: string | null) {
  if (!notificationId) return;
  const Notifications = getNotificationsModule();
  if (Notifications) {
    try {
      if (Notifications.dismissNotificationAsync) {
        await Notifications.dismissNotificationAsync(notificationId).catch(() => null);
      }
      if (Notifications.cancelScheduledNotificationAsync) {
        await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => null);
      }
    } catch {
      // ignore
    }
  }

  const bridge = getSmsBridge();
  if (bridge?.clearPendingApproval) {
    try {
      await bridge.clearPendingApproval(notificationId);
    } catch {
      // ignore
    }
  }

  if (userId) {
    try {
      const ref = doc(db, `users/${userId}/notifications`, notificationId);
      await updateDoc(ref, { read: true, resolvedAt: Date.now() }).catch(() => null);
    } catch {
      // ignore
    }
  }
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
  // Deduplicate: If sent in the last 2 minutes, don't re-dispatch push
  const lastSentTime = sentNotificationCooldownMap.get(params.notificationId);
  if (lastSentTime && Date.now() - lastSentTime < 120000) {
    return;
  }
  sentNotificationCooldownMap.set(params.notificationId, Date.now());

  const ref = doc(collection(db, `users/${params.userId}/notifications`), params.notificationId);
  await setDoc(
    ref,
    {
      title: params.title,
      body: params.body,
      notificationType: params.notificationType,
      data: params.data || {},
      read: params.read ?? false,
      delivery: "received",
      createdAt: Date.now(),
    },
    { merge: true }
  );

  // The client only records notifications. Delivery belongs to the trusted backend/admin
  // sender; sending another push here can duplicate a notification or create a loop.
}

/**
 * Sends a push notification when a budget threshold is crossed.
 * Called automatically by BudgetContext when spending hits 50%, 80%, 100%, or >100%.
 */
export async function sendBudgetAlert(
  categoryName: string,
  percentage: number,
  remaining: number,
  limit: number,
  householdName?: string
): Promise<void> {
  const Notifications = getNotificationsModule();
  if (!Notifications) return;

  // 24-Hour Cooldown & Deduplication per category milestone
  const roundedPercent = Math.round(percentage);
  const cooldownKey = `@budget_alert_cooldown_${householdName || "personal"}_${categoryName}_${roundedPercent}`;
  try {
    const lastSent = await AsyncStorage.getItem(cooldownKey);
    if (lastSent) {
      const lastTime = parseInt(lastSent, 10);
      // If sent in the last 20 hours, skip sending duplicate
      if (Date.now() - lastTime < 20 * 60 * 60 * 1000) {
        return;
      }
    }
  } catch {
    // continue
  }

  const isExceeded = percentage > 100;
  const isLimitReached = percentage === 100 || (percentage >= 100 && !isExceeded);
  const isCritical = percentage >= 80 && percentage < 100;

  const prefix = householdName ? `🏠 [${householdName}] ` : "";
  const emoji = isExceeded ? "🚨" : isLimitReached ? "⚠️" : isCritical ? "⚡" : "💡";
  const title = isExceeded
    ? `${emoji} ${prefix}Budget Exceeded: ${categoryName}`
    : isLimitReached
    ? `${emoji} ${prefix}Budget Limit Reached: ${categoryName}`
    : `${emoji} ${prefix}Budget Alert: ${categoryName}`;

  const body = isExceeded
    ? `${householdName ? `Flat "${householdName}" has` : "You have"} exceeded the ₹${limit.toLocaleString("en-IN")} budget for ${categoryName} by ₹${Math.abs(remaining).toLocaleString("en-IN")}.`
    : isLimitReached
    ? `${householdName ? `Flat "${householdName}" has` : "You have"} reached 100% of the ₹${limit.toLocaleString("en-IN")} budget for ${categoryName} (₹0 remaining).`
    : `${householdName ? `Flat "${householdName}" has` : "You've"} used ${roundedPercent}% of the ${categoryName} budget. ₹${remaining.toLocaleString("en-IN")} remaining.`;

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

    await AsyncStorage.setItem(cooldownKey, Date.now().toString());
  } catch (e) {
    console.warn("[Notifications] Budget alert failed:", e);
  }
}
