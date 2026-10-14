import { collection, doc, getDocs, limit, query, setDoc, where } from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { SMSApprovalPayload } from "@/utils/notifications";

/**
 * The only writer for an SMS-derived expense. A deterministic document id and
 * a lookup by SMS id make this safe to call from the review screen, a
 * notification action, or background auto-add without creating duplicates.
 */
export async function saveSmsExpense(userId: string, transaction: SMSApprovalPayload): Promise<boolean> {
  if (!userId || !transaction.smsId || !Number.isFinite(transaction.amount) || transaction.amount <= 0) {
    return false;
  }

  const existing = await getDocs(
    query(
      collection(db, `users/${userId}/expenses`),
      where("smsId", "==", transaction.smsId),
      limit(1)
    )
  );
  if (!existing.empty) return false;

  const safeId = transaction.smsId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
  await setDoc(doc(db, `users/${userId}/expenses/sms_${safeId}`), {
    amount: transaction.amount,
    note: transaction.note || `Auto-synced: ${transaction.merchant}`,
    categoryId: transaction.categoryId,
    paymentMode: transaction.paymentMode,
    date: transaction.date,
    smsId: transaction.smsId,
    merchant: transaction.merchant || "Unknown Merchant",
    createdAt: Date.now(),
    source: "sms",
  });

  return true;
}
