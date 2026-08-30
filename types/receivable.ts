export type ReceivableStatus =
  | "RETURN_REQUESTED"
  | "PICKED_UP"
  | "REFUND_INITIATED"
  | "WAITING"
  | "OVERDUE"
  | "SUPPORT_CONTACTED"
  | "ESCALATED"
  | "NCH_GRIEVANCE"
  | "RECOVERED"
  | "CANCELLED";

export type ReceivableCategory =
  | "ecommerce_return"
  | "cancellation"
  | "upi_reversal"
  | "deposit"
  | "cashback"
  | "reimbursement"
  | "other";

export interface EvidenceDocument {
  id: string;
  type: "order_confirmation" | "return_request" | "pickup_receipt" | "refund_commitment" | "support_chat" | "other";
  title: string;
  details?: string;
  timestamp: number;
}

export interface ReceivableHistoryLog {
  id: string;
  timestamp: number;
  status: ReceivableStatus;
  note: string;
  actor?: "user" | "system" | "merchant_support";
  newExpectedDate?: string;
}

export interface Receivable {
  id: string;
  userId: string;
  merchant: string;
  amount: number;
  category: ReceivableCategory;
  orderId?: string;
  status: ReceivableStatus;
  dateInitiated: string; // ISO YYYY-MM-DD
  expectedRefundDate: string; // ISO YYYY-MM-DD
  actualRefundDate?: string; // ISO YYYY-MM-DD
  delayDays?: number;
  promisedWindow?: string; // e.g. "3-5 business days"
  notes?: string;
  evidence: EvidenceDocument[];
  history: ReceivableHistoryLog[];
  supportCaseNumber?: string;
  lastSupportContactDate?: string;
  createdAt: number;
  updatedAt: number;
  autoSyncedSmsId?: string;
}

export const CATEGORY_LABELS: Record<ReceivableCategory, { label: string; icon: string; color: string }> = {
  ecommerce_return: { label: "E-Commerce Return", icon: "shopping-bag", color: "#3b82f6" },
  cancellation: { label: "Flight / Booking Cancel", icon: "navigation", color: "#f59e0b" },
  upi_reversal: { label: "Failed UPI / Card Reversal", icon: "refresh-cw", color: "#ec4899" },
  deposit: { label: "Security Deposit", icon: "lock", color: "#8b5cf6" },
  cashback: { label: "Cashback", icon: "gift", color: "#10b981" },
  reimbursement: { label: "Reimbursement / Claim", icon: "file-text", color: "#06b6d4" },
  other: { label: "Other Refund", icon: "more-horizontal", color: "#64748b" },
};
