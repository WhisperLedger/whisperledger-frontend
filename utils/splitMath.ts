import { DebtSummary, ExpenseSplit, HouseholdExpense, HouseholdMember, MemberBalance } from "@/types/household";

/**
 * Calculates equal splits for a given total amount across selected members.
 * Handles fractional rounding so the sum of individual shares EXACTLY matches total amount.
 */
export function calculateEqualSplits(
  amount: number,
  selectedMembers: Array<{ uid: string; name: string; avatarUri?: string }>,
  payerUid?: string
): ExpenseSplit[] {
  if (!selectedMembers || selectedMembers.length === 0 || amount <= 0) {
    return [];
  }

  const count = selectedMembers.length;
  // Floor to 2 decimal places in paise / cents
  const totalCents = Math.round(amount * 100);
  const baseCentsPerPerson = Math.floor(totalCents / count);
  let remainderCents = totalCents - baseCentsPerPerson * count;

  return selectedMembers.map((member) => {
    // Distribute remainder cents 1-by-1 to members until exhausted (starting from payer if present)
    let extra = 0;
    if (remainderCents > 0) {
      extra = 1;
      remainderCents--;
    }
    const memberShareCents = baseCentsPerPerson + extra;
    const share = memberShareCents / 100;
    return {
      uid: member.uid,
      name: member.name,
      avatarUri: member.avatarUri,
      share: Number(share.toFixed(2)),
      percentage: Number(((share / amount) * 100).toFixed(1)),
    };
  });
}

/**
 * Validates variable splits against total amount.
 */
export function validateVariableSplits(
  amount: number,
  splits: Array<{ share: number }>
): { isValid: boolean; difference: number; allocatedSum: number } {
  const allocatedSum = splits.reduce((sum, s) => sum + (Number(s.share) || 0), 0);
  const diff = Number((amount - allocatedSum).toFixed(2));
  return {
    isValid: Math.abs(diff) < 0.01,
    difference: diff,
    allocatedSum: Number(allocatedSum.toFixed(2)),
  };
}

/**
 * Computes individual member balances (total paid, total owed, net balance)
 * from a list of household expenses and members.
 */
export function calculateHouseholdBalances(
  members: Record<string, HouseholdMember>,
  expenses: HouseholdExpense[]
): Record<string, MemberBalance> {
  const balances: Record<string, MemberBalance> = {};

  // Initialize for all known members
  Object.values(members).forEach((member) => {
    balances[member.uid] = {
      uid: member.uid,
      name: member.name,
      avatarUri: member.avatarUri,
      totalPaid: 0,
      totalShare: 0,
      netBalance: 0,
    };
  });

  expenses.forEach((expense) => {
    if (expense.isSettlement) {
      // Settlement transaction: payerUid paid recipientUid
      const payerId = expense.payerUid;
      const recipientId = expense.settlementDetails?.recipientUid;
      const amt = Number(expense.amount) || 0;

      if (balances[payerId]) {
        balances[payerId].totalPaid += amt;
      }
      if (recipientId && balances[recipientId]) {
        balances[recipientId].totalShare += amt;
      }
      return;
    }

    // Standard split expense
    const payerId = expense.payerUid;
    const totalAmount = Number(expense.amount) || 0;

    if (balances[payerId]) {
      balances[payerId].totalPaid += totalAmount;
    }

    if (Array.isArray(expense.splits)) {
      expense.splits.forEach((split) => {
        const memberId = split.uid;
        const share = Number(split.share) || 0;
        if (balances[memberId]) {
          balances[memberId].totalShare += share;
        } else {
          // In case of historical member not currently in members map
          balances[memberId] = {
            uid: memberId,
            name: split.name || "Former Member",
            avatarUri: split.avatarUri,
            totalPaid: 0,
            totalShare: share,
            netBalance: 0,
          };
        }
      });
    }
  });

  // Calculate net balances (Net = Total Paid - Total Share)
  Object.keys(balances).forEach((uid) => {
    const b = balances[uid];
    b.totalPaid = Number(b.totalPaid.toFixed(2));
    b.totalShare = Number(b.totalShare.toFixed(2));
    b.netBalance = Number((b.totalPaid - b.totalShare).toFixed(2));
  });

  return balances;
}

/**
 * Calculates pairwise simplified debts from net balances.
 * Determines who owes whom directly.
 */
export function calculatePairwiseDebts(
  balances: Record<string, MemberBalance>
): DebtSummary[] {
  const debtors: Array<{ uid: string; name: string; amount: number }> = [];
  const creditors: Array<{ uid: string; name: string; amount: number }> = [];

  Object.values(balances).forEach((b) => {
    if (b.netBalance < -0.01) {
      debtors.push({ uid: b.uid, name: b.name, amount: -b.netBalance });
    } else if (b.netBalance > 0.01) {
      creditors.push({ uid: b.uid, name: b.name, amount: b.netBalance });
    }
  });

  const debts: DebtSummary[] = [];

  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const settledAmount = Math.min(debtor.amount, creditor.amount);

    if (settledAmount > 0.01) {
      debts.push({
        fromUid: debtor.uid,
        fromName: debtor.name,
        toUid: creditor.uid,
        toName: creditor.name,
        amount: Number(settledAmount.toFixed(2)),
      });
    }

    debtor.amount -= settledAmount;
    creditor.amount -= settledAmount;

    if (debtor.amount < 0.01) dIdx++;
    if (creditor.amount < 0.01) cIdx++;
  }

  return debts;
}

/**
 * Generates a clean 6-character alphanumeric invite code (e.g. WL-7K2X)
 */
export function generateInviteCode(): string {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // exclude confusing chars like 0, 1, I, O
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
