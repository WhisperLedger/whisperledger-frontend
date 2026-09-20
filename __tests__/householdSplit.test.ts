import {
  calculateEqualSplits,
  validateVariableSplits,
  calculateHouseholdBalances,
  calculatePairwiseDebts,
  generateInviteCode,
} from "../utils/splitMath";
import { HouseholdExpense, HouseholdMember } from "../types/household";

describe("Household Split Math & Debt Resolution", () => {
  test("Equal split handles odd cents/paisa rounding perfectly", () => {
    const members = [
      { uid: "u1", name: "Tanmay" },
      { uid: "u2", name: "Alex" },
      { uid: "u3", name: "Sam" },
    ];
    // ₹100 split 3 ways -> 33.34, 33.33, 33.33
    const splits = calculateEqualSplits(100, members, "u1");
    expect(splits).toHaveLength(3);
    const sum = splits.reduce((acc, s) => acc + s.share, 0);
    expect(sum).toBe(100);
    expect(splits[0].share).toBe(33.34);
    expect(splits[1].share).toBe(33.33);
    expect(splits[2].share).toBe(33.33);
  });

  test("Equal split with ₹1000 across 7 members sums to exact ₹1000", () => {
    const members = Array.from({ length: 7 }, (_, i) => ({
      uid: `u${i + 1}`,
      name: `Member ${i + 1}`,
    }));
    const splits = calculateEqualSplits(1000, members, "u1");
    expect(splits).toHaveLength(7);
    const sum = splits.reduce((acc, s) => acc + s.share, 0);
    expect(Number(sum.toFixed(2))).toBe(1000);
  });

  test("Variable split validation detects match and mismatch", () => {
    const validSplits = [{ share: 600 }, { share: 400 }];
    expect(validateVariableSplits(1000, validSplits).isValid).toBe(true);

    const invalidSplits = [{ share: 600 }, { share: 300 }];
    const res = validateVariableSplits(1000, invalidSplits);
    expect(res.isValid).toBe(false);
    expect(res.difference).toBe(100);
    expect(res.allocatedSum).toBe(900);
  });

  test("Calculate household balances and pairwise debts accurately", () => {
    const members: Record<string, HouseholdMember> = {
      u1: { uid: "u1", name: "Tanmay", email: "t@w.com", role: "admin", joinedAt: 1 },
      u2: { uid: "u2", name: "Alex", email: "a@w.com", role: "member", joinedAt: 1 },
      u3: { uid: "u3", name: "Sam", email: "s@w.com", role: "member", joinedAt: 1 },
    };

    // Tanmay paid ₹1200 split equally among u1, u2, u3 (₹400 each)
    const expense1: HouseholdExpense = {
      id: "exp1",
      householdId: "h1",
      createdBy: "u1",
      createdByName: "Tanmay",
      amount: 1200,
      categoryId: "groceries",
      paymentMode: "upi",
      note: "Groceries",
      date: "2026-09-02",
      createdAt: 100,
      payerUid: "u1",
      payerName: "Tanmay",
      splitType: "equal",
      splits: [
        { uid: "u1", name: "Tanmay", share: 400 },
        { uid: "u2", name: "Alex", share: 400 },
        { uid: "u3", name: "Sam", share: 400 },
      ],
    };

    const balances = calculateHouseholdBalances(members, [expense1]);

    // u1 paid 1200, share 400 -> net +800
    expect(balances.u1.netBalance).toBe(800);
    // u2 paid 0, share 400 -> net -400
    expect(balances.u2.netBalance).toBe(-400);
    // u3 paid 0, share 400 -> net -400
    expect(balances.u3.netBalance).toBe(-400);

    const debts = calculatePairwiseDebts(balances);
    expect(debts).toHaveLength(2);
    expect(debts).toEqual(
      expect.arrayContaining([
        { fromUid: "u2", fromName: "Alex", toUid: "u1", toName: "Tanmay", amount: 400 },
        { fromUid: "u3", fromName: "Sam", toUid: "u1", toName: "Tanmay", amount: 400 },
      ])
    );
  });

  test("Settlement clears debt between members", () => {
    const members: Record<string, HouseholdMember> = {
      u1: { uid: "u1", name: "Tanmay", email: "t@w.com", role: "admin", joinedAt: 1 },
      u2: { uid: "u2", name: "Alex", email: "a@w.com", role: "member", joinedAt: 1 },
    };

    const expense: HouseholdExpense = {
      id: "exp1",
      householdId: "h1",
      createdBy: "u1",
      createdByName: "Tanmay",
      amount: 1000,
      categoryId: "rent",
      paymentMode: "upi",
      note: "Wifi",
      date: "2026-09-02",
      createdAt: 100,
      payerUid: "u1",
      payerName: "Tanmay",
      splitType: "equal",
      splits: [
        { uid: "u1", name: "Tanmay", share: 500 },
        { uid: "u2", name: "Alex", share: 500 },
      ],
    };

    // Alex pays Tanmay ₹500 to settle up
    const settlement: HouseholdExpense = {
      id: "settle1",
      householdId: "h1",
      createdBy: "u2",
      createdByName: "Alex",
      amount: 500,
      categoryId: "transfer",
      paymentMode: "upi",
      note: "Settle Up",
      date: "2026-09-02",
      createdAt: 200,
      payerUid: "u2",
      payerName: "Alex",
      splitType: "equal",
      splits: [],
      isSettlement: true,
      settlementDetails: {
        recipientUid: "u1",
        recipientName: "Tanmay",
      },
    };

    const balances = calculateHouseholdBalances(members, [expense, settlement]);
    expect(balances.u1.netBalance).toBe(0);
    expect(balances.u2.netBalance).toBe(0);

    const debts = calculatePairwiseDebts(balances);
    expect(debts).toHaveLength(0);
  });

  test("Generate invite code outputs a 6-character alphanumeric string", () => {
    const code = generateInviteCode();
    expect(code).toHaveLength(6);
    expect(/^[2-9A-HJ-NP-Z]{6}$/.test(code)).toBe(true);
  });
});
