import { CategoryId, PaymentMode } from "@/context/ExpenseContext";

export type SplitType = "equal" | "variable";

export interface ExpenseSplit {
  uid: string;
  name: string;
  avatarUri?: string;
  share: number; // The amount owed/allocated to this member
  percentage?: number;
  status?: "pending" | "accepted" | "declined";
}

export interface HouseholdMember {
  uid: string;
  name: string;
  email: string;
  avatarUri?: string;
  role: "admin" | "member";
  joinedAt: number;
}

export interface HouseholdExpense {
  id: string;
  householdId: string;
  createdBy: string; // UID of user who logged the expense
  createdByName: string;
  amount: number;
  categoryId: CategoryId;
  paymentMode: PaymentMode;
  note: string;
  merchant?: string;
  location?: string;
  date: string; // ISO date YYYY-MM-DD
  createdAt: number;
  updatedAt?: number;
  
  // Split attributes
  payerUid: string; // UID of person who paid the bill
  payerName: string;
  splitType: SplitType;
  splits: ExpenseSplit[]; // Breakdown per member

  // Settlement attributes
  isSettlement?: boolean;
  settlementDetails?: {
    recipientUid: string;
    recipientName: string;
  };
}

export interface Household {
  id: string;
  name: string;
  createdBy: string;
  createdAt: number;
  inviteCode: string;
  members: Record<string, HouseholdMember>;
  memberUids: string[];
}

export interface DebtSummary {
  fromUid: string;
  fromName: string;
  toUid: string;
  toName: string;
  amount: number;
}

export interface MemberBalance {
  uid: string;
  name: string;
  avatarUri?: string;
  totalPaid: number; // Total amount paid out of pocket
  totalShare: number; // Total amount owed across all splits
  netBalance: number; // totalPaid - totalShare (>0 means owed to them, <0 means they owe)
}
