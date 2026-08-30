jest.mock("@/lib/firebase", () => ({ db: {} }));

const mockScheduleNotificationAsync = jest.fn();

jest.mock("expo-notifications", () => ({
  scheduleNotificationAsync: mockScheduleNotificationAsync,
}));

import { scheduleSMSApprovalNotification, SMS_APPROVAL_CATEGORY, SMS_APPROVAL_TYPE } from "../utils/notifications";

describe("scheduleSMSApprovalNotification", () => {
  beforeEach(() => {
    mockScheduleNotificationAsync.mockClear();
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
        },
      },
      trigger: null,
    });
  });
});
