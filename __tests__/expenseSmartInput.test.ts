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

  it("infers maid and cook category accurately", () => {
    const draft = inferExpenseDraft("maid salary 4500 cash");
    expect(draft.amount).toBe(4500);
    expect(draft.categoryId).toBe("maid_cook");
    expect(draft.paymentMode).toBe("cash");

    const draft2 = inferExpenseDraft("cook 3000 via upi");
    expect(draft2.amount).toBe(3000);
    expect(draft2.categoryId).toBe("maid_cook");
    expect(draft2.paymentMode).toBe("upi");
  });
});
