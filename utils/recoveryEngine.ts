import type { Receivable, ReceivableStatus } from "@/types/receivable";

export interface StatusMeta {
  label: string;
  badgeColor: string;
  textColor: string;
  iconName: string;
  isOverdue: boolean;
}

export function getReceivableStatusMeta(status: ReceivableStatus, expectedRefundDate: string): StatusMeta {
  const today = new Date().toISOString().split("T")[0];
  const isDatePassed = today > expectedRefundDate;

  if (status === "RECOVERED") {
    return {
      label: "RECOVERED ✓",
      badgeColor: "rgba(16, 185, 129, 0.15)",
      textColor: "#10b981",
      iconName: "check-circle",
      isOverdue: false,
    };
  }

  if (status === "CANCELLED") {
    return {
      label: "CANCELLED",
      badgeColor: "rgba(100, 116, 139, 0.15)",
      textColor: "#64748b",
      iconName: "x-circle",
      isOverdue: false,
    };
  }

  if (status === "OVERDUE" || isDatePassed) {
    return {
      label: "OVERDUE 🔴",
      badgeColor: "rgba(239, 68, 68, 0.15)",
      textColor: "#ef4444",
      iconName: "alert-circle",
      isOverdue: true,
    };
  }

  if (status === "SUPPORT_CONTACTED") {
    return {
      label: "SUPPORT CONTACTED",
      badgeColor: "rgba(245, 158, 11, 0.15)",
      textColor: "#f59e0b",
      iconName: "clock",
      isOverdue: isDatePassed,
    };
  }

  if (status === "ESCALATED") {
    return {
      label: "ESCALATED ⚠️",
      badgeColor: "rgba(249, 115, 22, 0.15)",
      textColor: "#f97316",
      iconName: "shield-alert",
      isOverdue: true,
    };
  }

  if (status === "NCH_GRIEVANCE") {
    return {
      label: "NCH GRIEVANCE",
      badgeColor: "rgba(37, 99, 235, 0.15)",
      textColor: "#2563EB",
      iconName: "file-text",
      isOverdue: true,
    };
  }

  if (status === "PICKED_UP") {
    return {
      label: "RETURN PICKED UP",
      badgeColor: "rgba(59, 130, 246, 0.15)",
      textColor: "#3b82f6",
      iconName: "package",
      isOverdue: false,
    };
  }

  if (status === "RETURN_REQUESTED") {
    return {
      label: "RETURN REQUESTED",
      badgeColor: "rgba(0, 102, 255, 0.15)",
      textColor: "#0066FF",
      iconName: "rotate-ccw",
      isOverdue: false,
    };
  }

  // REFUND_INITIATED / WAITING
  return {
    label: "REFUND EXPECTED",
    badgeColor: "rgba(16, 185, 129, 0.12)",
    textColor: "#059669",
    iconName: "clock",
    isOverdue: false,
  };
}

export function calculateDaysOverdue(expectedRefundDate: string): number {
  const expected = new Date(expectedRefundDate);
  const now = new Date();
  const diffTime = now.getTime() - expected.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

export function generateEvidenceSummary(r: Receivable): string {
  const daysOverdue = calculateDaysOverdue(r.expectedRefundDate);
  const lines: string[] = [
    `📌 RECOVERY DOSSIER: ${r.merchant.toUpperCase()}`,
    `• Amount Owed: ₹${r.amount.toLocaleString("en-IN")}`,
    `• Order/Ref ID: ${r.orderId || "N/A"}`,
    `• Date Initiated: ${r.dateInitiated}`,
    `• Refund Promised SLA: ${r.promisedWindow || "3–5 business days"}`,
    `• Promised Deadline: ${r.expectedRefundDate}`,
    `• Delay Status: ${daysOverdue > 0 ? `${daysOverdue} days overdue` : "Deadline approaching"}`,
  ];

  if (r.history.length > 0) {
    lines.push(`\n📋 TIMELINE EVIDENCE:`);
    r.history.forEach((h) => {
      const dateStr = new Date(h.timestamp).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
      lines.push(`• ${dateStr} - [${h.status}] ${h.note}`);
    });
  }

  return lines.join("\n");
}

export function generateEscalationDraft(r: Receivable, level: 1 | 2 | 3): { title: string; body: string } {
  const daysOverdue = calculateDaysOverdue(r.expectedRefundDate);
  const orderRef = r.orderId ? `Order ID: ${r.orderId}` : `Transaction Amount: ₹${r.amount}`;

  if (level === 1) {
    return {
      title: "Level 1: Merchant Support Message",
      body:
        `Hello ${r.merchant} Support Team,\n\n` +
        `I am following up regarding a pending refund of ₹${r.amount.toLocaleString("en-IN")} (${orderRef}).\n\n` +
        `Timeline & Evidence:\n` +
        `• Initiated on: ${r.dateInitiated}\n` +
        `• Promised Refund SLA: ${r.promisedWindow || "3-5 business days"} (Expected by ${r.expectedRefundDate})\n` +
        `• Current Status: Overdue by ${daysOverdue} day(s) with no credit received in my bank account.\n\n` +
        `Please expedite the processing of this refund immediately and share the UTR / ARN transaction reference number for tracking.\n\n` +
        `Thank you.`,
    };
  }

  if (level === 2) {
    return {
      title: "Level 2: Internal Nodal / Manager Escalation",
      body:
        `ATTN: Grievance Officer / Nodal Team, ${r.merchant}\n\n` +
        `SUBJECT: Formal Complaint - Unprocessed Refund ₹${r.amount.toLocaleString("en-IN")} [${orderRef}]\n\n` +
        `Dear Grievance Officer,\n\n` +
        `I am writing to register a formal complaint regarding an unresolved refund of ₹${r.amount.toLocaleString("en-IN")}.\n\n` +
        `Summary of Case:\n` +
        `1. ${orderRef} was returned/cancelled on ${r.dateInitiated}.\n` +
        `2. Promised resolution timeline was ${r.expectedRefundDate}, which passed ${daysOverdue} days ago.\n` +
        `3. Customer support interactions have failed to process the payment or provide a valid UTR.\n\n` +
        `If this refund is not credited within 48 hours, I will be compelled to lodge a formal complaint on the National Consumer Helpline (NCH) portal.\n\n` +
        `Regards,\nWhisperLedger Recovery Agent User`,
    };
  }

  // Level 3: NCH Grievance Template
  return {
    title: "Level 3: National Consumer Helpline (NCH) Grievance",
    body:
      `NATIONAL CONSUMER HELPLINE (NCH) GRIEVANCE DRAFT\n` +
      `--------------------------------------------------\n` +
      `Company Name: ${r.merchant}\n` +
      `Grievance Category: E-Commerce / Non-Refund of Paid Amount\n` +
      `Disputed Amount: ₹${r.amount.toLocaleString("en-IN")}\n` +
      `Transaction/Order ID: ${r.orderId || "N/A"}\n` +
      `Date of Transaction/Return: ${r.dateInitiated}\n\n` +
      `Grievance Details:\n` +
      `The product/service under ${orderRef} was returned/cancelled on ${r.dateInitiated}. ` +
      `The merchant promised a refund of ₹${r.amount} by ${r.expectedRefundDate}. ` +
      `Despite repeated follow-ups, the refund has been delayed by ${daysOverdue} days. ` +
      `Requesting NCH intervention to facilitate full refund with interest for delayed payment.`,
  };
}
