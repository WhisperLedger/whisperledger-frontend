import { parseReceivableFromText, calculateDefaultSLA, isCreditOrReversalSMS } from "../utils/receivablesParser";
import { getReceivableStatusMeta, calculateDaysOverdue, generateEvidenceSummary, generateEscalationDraft } from "../utils/recoveryEngine";
import type { Receivable } from "../types/receivable";

describe("Receivables Parser", () => {
  it("should extract Amazon return details correctly from text", () => {
    const raw = "Your Amazon return of ₹8,499 for order #402-19283 has been picked up. Refund promised in 3-5 business days.";
    const parsed = parseReceivableFromText(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.merchant).toBe("Amazon");
    expect(parsed?.amount).toBe(8499);
    expect(parsed?.orderId).toBe("402-19283");
    expect(parsed?.category).toBe("ecommerce_return");
    expect(parsed?.status).toBe("PICKED_UP");
  });

  it("should extract MakeMyTrip flight cancellation details", () => {
    const raw = "Flight booking cancelled. Refund of Rs 4800 from MakeMyTrip initiated. Ticket ID: MMT89201.";
    const parsed = parseReceivableFromText(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.merchant).toBe("MakeMyTrip");
    expect(parsed?.amount).toBe(4800);
    expect(parsed?.category).toBe("cancellation");
    expect(parsed?.orderId).toBe("MMT89201");
  });

  it("should calculate correct default SLAs", () => {
    expect(calculateDefaultSLA("Swiggy", "ecommerce_return").days).toBe(2);
    expect(calculateDefaultSLA("Amazon", "ecommerce_return").days).toBe(5);
    expect(calculateDefaultSLA("MakeMyTrip", "cancellation").days).toBe(7);
  });

  it("should identify bank credit / reversal SMS", () => {
    expect(isCreditOrReversalSMS("Rs 8,499 credited to your A/C from Amazon Refund")).toBe(true);
    expect(isCreditOrReversalSMS("INR 4800 reversed for failed UPI transaction")).toBe(true);
    expect(isCreditOrReversalSMS("Rs 500 debited for dinner")).toBe(false);
  });
});

describe("Recovery Engine", () => {
  const mockReceivable: Receivable = {
    id: "rec_1",
    userId: "user_1",
    merchant: "Amazon",
    amount: 8499,
    category: "ecommerce_return",
    orderId: "402-19283",
    status: "OVERDUE",
    dateInitiated: "2026-08-10",
    expectedRefundDate: "2026-08-15",
    promisedWindow: "3–5 business days",
    evidence: [],
    history: [
      {
        id: "h1",
        timestamp: Date.now() - 5 * 86400000,
        status: "PICKED_UP",
        note: "Return picked up",
        actor: "system",
      },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  it("should generate evidence dossier text", () => {
    const summary = generateEvidenceSummary(mockReceivable);
    expect(summary).toContain("RECOVERY DOSSIER: AMAZON");
    expect(summary).toContain("Amount Owed: ₹8,499");
    expect(summary).toContain("402-19283");
  });

  it("should generate 3-level escalation ladder drafts", () => {
    const l1 = generateEscalationDraft(mockReceivable, 1);
    expect(l1.title).toContain("Level 1");
    expect(l1.body).toContain("Amazon Support Team");

    const l2 = generateEscalationDraft(mockReceivable, 2);
    expect(l2.title).toContain("Level 2");
    expect(l2.body).toContain("Formal Complaint");

    const l3 = generateEscalationDraft(mockReceivable, 3);
    expect(l3.title).toContain("Level 3");
    expect(l3.body).toContain("NATIONAL CONSUMER HELPLINE");
  });

  it("should return correct status metadata for overdue and recovered items", () => {
    const overdueMeta = getReceivableStatusMeta("OVERDUE", "2026-08-10");
    expect(overdueMeta.isOverdue).toBe(true);

    const recoveredMeta = getReceivableStatusMeta("RECOVERED", "2026-08-10");
    expect(recoveredMeta.isOverdue).toBe(false);
    expect(recoveredMeta.textColor).toBe("#10b981");
  });
});
