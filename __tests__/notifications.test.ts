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
        body: "Spent Rs 849 at Swiggy. Approve?",
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
  });
});
