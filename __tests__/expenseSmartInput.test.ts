import { inferExpenseDraft, inferPaymentMode } from "../utils/expenseSmartInput";

describe("expense smart input", () => {
  it("extracts amount, merchant, category, and payment mode from a natural phrase", () => {
    const draft = inferExpenseDraft("spent ₹480 at Swiggy via UPI");

    expect(draft.amount).toBe(480);
    expect(draft.merchant).toBe("Swiggy");
    expect(draft.categoryId).toBe("food_outside");
    expect(draft.paymentMode).toBe("upi");
    expect(draft.signals).toEqual(expect.arrayContaining(["amount", "merchant", "category", "payment"]));
  });

  it("keeps merchant matching brand-specific", () => {
    expect(inferExpenseDraft("paid 340 at Zomato").merchant).toBe("Zomato");
    expect(inferExpenseDraft("paid 999 at Amazon").merchant).toBe("Amazon");
  });

  it("infers useful category from non-merchant keywords", () => {
    const draft = inferExpenseDraft("coffee with team 220");

    expect(draft.amount).toBe(220);
    expect(draft.categoryId).toBe("food_outside");
    expect(draft.merchant).toBeUndefined();
  });

  it("infers payment mode aliases", () => {
    expect(inferPaymentMode("paid with credit card")).toBe("card");
    expect(inferPaymentMode("cash for snacks")).toBe("cash");
    expect(inferPaymentMode("sent via NEFT")).toBe("netbanking");
    expect(inferPaymentMode("GPay to cafe")).toBe("upi");
  });
});
