jest.mock("@/lib/firebase", () => ({ db: {} }));
jest.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map<string, string>();
  return {
    getItem: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    }),
  };
});

const mockScheduleNotificationAsync = jest.fn();

jest.mock("expo-notifications", () => ({
  scheduleNotificationAsync: mockScheduleNotificationAsync,
}));
jest.mock("expo-constants", () => ({
  expoConfig: { extra: { eas: { projectId: "mock-project-id" } } },
}));
jest.mock("expo-device", () => ({
  isDevice: true,
}));

import { scheduleSMSApprovalNotification, SMS_APPROVAL_CATEGORY, SMS_APPROVAL_TYPE } from "../utils/notifications";

describe("scheduleSMSApprovalNotification", () => {
  beforeEach(() => {
    mockScheduleNotificationAsync.mockClear();
    mockScheduleNotificationAsync.mockResolvedValue("notif_1");
  });

  test("keeps parsed SMS transaction fields in the approval payload", async () => {
    const transaction = {
      amount: 849,
      merchant: "Swiggy",
      smsId: "sms_123",
      date: "2026-08-09",
      categoryId: "food_outside" as const,
      paymentMode: "card" as const,
      note: "Auto-synced: Swiggy",
    };

    await scheduleSMSApprovalNotification(transaction);

    expect(mockScheduleNotificationAsync).toHaveBeenCalledWith({
      content: {
        title: "New Transaction Detected",
        body: "Spent ₹849 at Swiggy. Approve?",
        categoryIdentifier: SMS_APPROVAL_CATEGORY,
        data: {
          ...transaction,
          notificationType: SMS_APPROVAL_TYPE,
          isLocalOnly: true,
          smsApproval: true,
          deepLink: "/notifications?smsApproval=true&smsId=sms_123&amount=849&merchant=Swiggy&date=2026-08-09",
        },
        sound: true,
        priority: "high",
        channelId: "default",
      },
      trigger: null,
    });
  });

  test("does not schedule duplicate notification if transaction was already queued", async () => {
    const transaction = {
      amount: 450,
      merchant: "Zomato",
      smsId: "sms_duplicate_1",
      date: "2026-08-09",
      categoryId: "food_outside" as const,
      paymentMode: "upi" as const,
      note: "Auto-synced: Zomato",
    };

    const first = await scheduleSMSApprovalNotification(transaction);
    expect(first).toBe("notif_1");

    // Second call with same transaction must be deduplicated
    mockScheduleNotificationAsync.mockClear();
    const second = await scheduleSMSApprovalNotification(transaction);
    expect(second).toBeNull();
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
