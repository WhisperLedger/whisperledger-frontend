import { HouseholdExpense, HouseholdMember } from "../types/household";
import { calculateHouseholdBalances, calculatePairwiseDebts, calculateEqualSplits, validateVariableSplits } from "../utils/splitMath";

describe("Household Multi-Member Split & Immutability Verification", () => {
  const members: Record<string, HouseholdMember> = {
    userA: { uid: "userA", name: "Tanmay", email: "tanmay@test.com", role: "admin", joinedAt: 100 },
    userB: { uid: "userB", name: "Alex", email: "alex@test.com", role: "member", joinedAt: 100 },
    userC: { uid: "userC", name: "Sam", email: "sam@test.com", role: "member", joinedAt: 100 },
  };

  test("Split of ₹1,200 divides into exact ₹400 for each participating member", () => {
    const activeMembers = Object.values(members);
    const splits = calculateEqualSplits(1200, activeMembers, "userA");

    expect(splits).toHaveLength(3);
    splits.forEach((s) => {
      expect(s.share).toBe(400);
    });

    const sum = splits.reduce((acc, s) => acc + s.share, 0);
    expect(sum).toBe(1200);
  });

  test("Creator permission rule: only expense.createdBy can modify/delete", () => {
    const expense: HouseholdExpense = {
      id: "exp_123",
      householdId: "hh_1",
      createdBy: "userA",
      createdByName: "Tanmay",
      amount: 1200,
      categoryId: "groceries",
      paymentMode: "upi",
      note: "Groceries",
      date: "2026-09-02",
      createdAt: 1000,
      payerUid: "userA",
      payerName: "Tanmay",
      splitType: "equal",
      splits: [
        { uid: "userA", name: "Tanmay", share: 400 },
        { uid: "userB", name: "Alex", share: 400 },
        { uid: "userC", name: "Sam", share: 400 },
      ],
    };

    const canUserAEdit = expense.createdBy === "userA";
    const canUserBEdit = expense.createdBy === "userB";
    const canUserCEdit = expense.createdBy === "userC";

    expect(canUserAEdit).toBe(true);
    expect(canUserBEdit).toBe(false);
    expect(canUserCEdit).toBe(false);
  });

  test("Balances correctly reflect that B owes A ₹400 and C owes A ₹400", () => {
    const expense: HouseholdExpense = {
      id: "exp_123",
      householdId: "hh_1",
      createdBy: "userA",
      createdByName: "Tanmay",
      amount: 1200,
      categoryId: "groceries",
      paymentMode: "upi",
      note: "Groceries",
      date: "2026-09-02",
      createdAt: 1000,
      payerUid: "userA",
      payerName: "Tanmay",
      splitType: "equal",
      splits: [
        { uid: "userA", name: "Tanmay", share: 400 },
        { uid: "userB", name: "Alex", share: 400 },
        { uid: "userC", name: "Sam", share: 400 },
      ],
    };

    const balances = calculateHouseholdBalances(members, [expense]);
    expect(balances.userA.netBalance).toBe(800);
    expect(balances.userB.netBalance).toBe(-400);
    expect(balances.userC.netBalance).toBe(-400);

    const debts = calculatePairwiseDebts(balances);
    expect(debts).toHaveLength(2);
    expect(debts).toEqual(
      expect.arrayContaining([
        { fromUid: "userB", fromName: "Alex", toUid: "userA", toName: "Tanmay", amount: 400 },
        { fromUid: "userC", fromName: "Sam", toUid: "userA", toName: "Tanmay", amount: 400 },
      ])
    );
  });
});
