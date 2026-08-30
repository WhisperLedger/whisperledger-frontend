import { Alert, Platform } from "react-native";
import * as Print from "expo-print";
import * as FileSystem from "expo-file-system/legacy";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CATEGORIES } from "@/context/ExpenseContext";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

export interface PDFExpense {
  date: string;
  note?: string;
  categoryId: string;
  paymentMode?: string;
  amount: number;
}

export interface PDFUser {
  uid: string;
  name?: string;
  email?: string;
}

type PDFSaveResult = "success" | "cancelled" | "unsupported" | "error";
export type PDFGenerationResult = PDFSaveResult | "no_data";

async function writePDFToAndroidFolder(uri: string, fileName: string): Promise<PDFSaveResult> {
  try {
    const downloadsUri = FileSystem.StorageAccessFramework.getUriForDirectoryInRoot?.("Download");
    const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(downloadsUri);

    if (!permissions.granted) {
      Alert.alert("Download cancelled", "Folder access is required to save the PDF on this device.");
      return "cancelled";
    }

    const targetUri = await FileSystem.StorageAccessFramework.createFileAsync(
      permissions.directoryUri,
      fileName,
      "application/pdf"
    );
    const base64Data = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    await FileSystem.writeAsStringAsync(targetUri, base64Data, { encoding: FileSystem.EncodingType.Base64 });
    Alert.alert("PDF Downloaded", `${fileName} was saved to the selected folder.`);
    return "success";
  } catch (error: any) {
    console.warn("Save PDF Error:", error);
    Alert.alert("Save failed", "Could not save the PDF to this device. Please try again.");
    return "error";
  }
}

async function savePDFToDevice(uri: string, fileName: string, monthLabel: string): Promise<PDFSaveResult> {
  if (Platform.OS !== "android" || !FileSystem.StorageAccessFramework) {
    Alert.alert(
      "Download unavailable",
      "Direct PDF download is only available on Android in this build."
    );
    return "unsupported";
  }

  return new Promise((resolve) => {
    Alert.alert(
      "Download PDF Statement",
      `Your ${monthLabel} statement is ready. Choose a folder on your device to save ${fileName}.`,
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => resolve("cancelled"),
        },
        {
          text: "Save to Device",
          onPress: async () => resolve(await writePDFToAndroidFolder(uri, fileName)),
        },
      ]
    );
  });
}

async function queueStatementEmail(params: {
  year: number;
  month: number;
  monthLabel: string;
  user: PDFUser | null;
  totalSpend: number;
  sortedCats: typeof CATEGORIES;
  catTotals: Record<string, number>;
  expenses: PDFExpense[];
}): Promise<boolean> {
  const { year, month, monthLabel, user, totalSpend, sortedCats, catTotals, expenses } = params;
  if (!user?.uid || !user.email) {
    Alert.alert("Email unavailable", "No signed-in email address was found for this account.");
    return false;
  }

  try {
    const requestRef = await addDoc(collection(db, "statement_requests"), {
      userId: user.uid,
      userEmail: user.email,
      userName: user.name || "Valued User",
      year,
      month,
      monthLabel,
      totalSpend,
      transactionCount: expenses.length,
      categoryTotals: sortedCats.map((c) => ({ label: c.label, amount: catTotals[c.id] || 0 })),
      expenses: expenses.map((e) => ({
        date: e.date,
        note: e.note || "Expense",
        categoryLabel: CATEGORIES.find((c) => c.id === e.categoryId)?.label || "Other",
        paymentMode: e.paymentMode || "none",
        amount: Number(e.amount || 0),
      })),
      deliveryChannel: "email",
      source: "pdf_export",
      createdAt: serverTimestamp(),
      status: "pending",
    });

    Alert.alert(
      "Email queued",
      `Statement request ${requestRef.id} was queued for ${user.email}.`
    );
    return true;
  } catch (err: any) {
    console.warn("Queue Email Error:", err);
    Alert.alert("Email failed", `Could not queue the email: ${err.message || "Unknown error"}`);
    return false;
  }
}

export async function queueMonthlyStatementEmail(
  year: number,
  month: number,
  expenses: PDFExpense[],
  user: PDFUser | null
): Promise<"success" | "no_data" | "error"> {
  if (expenses.length === 0) return "no_data";

  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`;
  const totalSpend = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const sortedCats = CATEGORIES.filter((c) => expenses.some((e) => e.categoryId === c.id));
  const catTotals: Record<string, number> = {};
  for (const e of expenses) {
    catTotals[e.categoryId] = (catTotals[e.categoryId] || 0) + Number(e.amount || 0);
  }

  const queued = await queueStatementEmail({ year, month, monthLabel, user, totalSpend, sortedCats, catTotals, expenses });
  return queued ? "success" : "error";
}

export async function generateAndSharePDF(
  year: number,
  month: number,
  expenses: PDFExpense[],
  user: PDFUser | null,
  onStart?: () => void,
  onEnd?: () => void
): Promise<PDFGenerationResult> {
  if (expenses.length === 0) return "no_data";

  onStart?.();

  try {
    const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`;
    const safeMonth = `${year}-${String(month).padStart(2, "0")}`;
    const fileName = `WhisperLedger-Statement-${safeMonth}.pdf`;

    const totalSpend = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const sortedCats = CATEGORIES.filter(
      (c) => expenses.some((e) => e.categoryId === c.id)
    );
    const catTotals: Record<string, number> = {};
    for (const e of expenses) {
      catTotals[e.categoryId] = (catTotals[e.categoryId] || 0) + Number(e.amount || 0);
    }

    const sorted = expenses.slice().sort((a, b) => a.date.localeCompare(b.date));
    const rows = sorted.map((e, idx) => {
      const cat = CATEGORIES.find((c) => c.id === e.categoryId)?.label || "Other";
      const note = (e.note || "Expense").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const stripe = idx % 2 === 0 ? "#f8fafc" : "#ffffff";
      return `<tr style="background:${stripe}"><td style="padding:10px 12px;border-bottom:1px solid #E5E1D8">${idx + 1}</td><td style="padding:10px 12px;border-bottom:1px solid #E5E1D8;white-space:nowrap">${e.date}</td><td style="padding:10px 12px;border-bottom:1px solid #E5E1D8">${note}</td><td style="padding:10px 12px;border-bottom:1px solid #E5E1D8">${cat}</td><td style="padding:10px 12px;border-bottom:1px solid #E5E1D8;text-align:center">${(e.paymentMode || "—").toUpperCase()}</td><td style="padding:10px 12px;border-bottom:1px solid #E5E1D8;text-align:right;font-weight:700;color:#17211F">₹${Number(e.amount || 0).toLocaleString("en-IN")}</td></tr>`;
    }).join("");

    const catRows = sortedCats
      .filter((c) => (catTotals[c.id] || 0) > 0)
      .sort((a, b) => (catTotals[b.id] || 0) - (catTotals[a.id] || 0))
      .map((cat, idx) => {
        const pct = totalSpend > 0 ? Math.round(((catTotals[cat.id] || 0) / totalSpend) * 100) : 0;
        const stripe = idx % 2 === 0 ? "#f8fafc" : "#ffffff";
        return `<tr style="background:${stripe}"><td style="padding:9px 12px;border-bottom:1px solid #E5E1D8">${cat.label}</td><td style="padding:9px 12px;border-bottom:1px solid #E5E1D8;text-align:right;font-weight:700">₹${Number(catTotals[cat.id] || 0).toLocaleString("en-IN")}</td><td style="padding:9px 12px;border-bottom:1px solid #E5E1D8;text-align:center;color:#68736F">${pct}%</td></tr>`;
      }).join("");

    const topCat = sortedCats.sort((a, b) => (catTotals[b.id] || 0) - (catTotals[a.id] || 0))[0];
    const avgPerTx = expenses.length > 0 ? Math.round(totalSpend / expenses.length) : 0;
    const generatedOn = new Date().toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" });

    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Helvetica Neue',Arial,sans-serif;background:#F7F4EF;color:#17211F;padding:0}
  .page{max-width:800px;margin:0 auto;background:#fff}
  .header-band{background:#0F766E;padding:36px 40px 28px;color:#fff}
  .bank-name{font-size:11px;letter-spacing:3px;text-transform:uppercase;opacity:.7;margin-bottom:8px}
  .doc-title{font-size:26px;font-weight:700;letter-spacing:-.5px}
  .doc-subtitle{font-size:13px;opacity:.75;margin-top:4px}
  .header-meta{display:flex;justify-content:space-between;align-items:flex-end;margin-top:24px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.2)}
  .meta-label{font-size:9px;letter-spacing:2px;text-transform:uppercase;opacity:.6;margin-bottom:4px}
  .meta-val{font-size:14px;font-weight:600}
  .summary-bar{display:flex;background:#17211F;padding:0}
  .sum-cell{flex:1;padding:20px 24px;border-right:1px solid rgba(255,255,255,0.08)}
  .sum-cell:last-child{border-right:none}
  .sum-label{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#9AA7A2;margin-bottom:6px}
  .sum-val{font-size:20px;font-weight:700;color:#fff}
  .sum-note{font-size:10px;color:#68736F;margin-top:2px}
  .section{padding:28px 40px}
  .section-title{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#68736F;font-weight:600;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid #E5E1D8}
  table{width:100%;border-collapse:collapse;font-size:12.5px}
  thead tr{background:#0F766E;color:#fff}
  thead th{padding:10px 12px;text-align:left;font-weight:600;font-size:10px;letter-spacing:.5px;text-transform:uppercase}
  thead th:last-child{text-align:right}
  .footer{background:#17211F;padding:20px 40px;display:flex;justify-content:space-between;align-items:center}
  .footer-brand{color:#fff;font-size:13px;font-weight:700;letter-spacing:1px}
  .footer-note{color:#68736F;font-size:10px;text-align:right}
</style></head><body>
<div class="page">
  <div class="header-band">
    <div class="bank-name">WhisperLedger</div>
    <div class="doc-title">Monthly Expense Statement</div>
    <div class="doc-subtitle">${monthLabel}</div>
    <div class="header-meta">
      <div><div class="meta-label">Account Holder</div><div class="meta-val">${user?.name || "Valued User"}</div><div style="font-size:11px;opacity:0.7">${user?.email || ""}</div></div>
      <div><div class="meta-label">Statement Period</div><div class="meta-val">${monthLabel}</div></div>
      <div><div class="meta-label">Generated On</div><div class="meta-val">${generatedOn}</div></div>
    </div>
  </div>
  <div class="summary-bar">
    <div class="sum-cell"><div class="sum-label">Total Spent</div><div class="sum-val">₹${Number(totalSpend || 0).toLocaleString("en-IN")}</div><div class="sum-note">${monthLabel}</div></div>
    <div class="sum-cell"><div class="sum-label">Avg per Transaction</div><div class="sum-val">₹${Number(avgPerTx || 0).toLocaleString("en-IN")}</div><div class="sum-note">across ${expenses.length} entries</div></div>
    <div class="sum-cell"><div class="sum-label">Top Category</div><div class="sum-val" style="font-size:15px">${topCat?.label || "—"}</div><div class="sum-note">₹${Number(catTotals[topCat?.id || ""] || 0).toLocaleString("en-IN")}</div></div>
  </div>
  <div class="section">
    <div class="section-title">Category Breakdown</div>
    <table><thead><tr><th>Category</th><th style="text-align:right">Amount</th><th style="text-align:center">Share</th></tr></thead>
    <tbody>${catRows || "<tr><td colspan='3' style='padding:12px;text-align:center;color:#9AA7A2'>No data</td></tr>"}</tbody></table>
  </div>
  <div class="section" style="padding-top:0">
    <div class="section-title">Transaction Details</div>
    <table><thead><tr><th>#</th><th>Date</th><th>Description</th><th>Category</th><th style="text-align:center">Mode</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr style="background:#E8F3EF"><td colspan="5" style="padding:10px 12px;font-weight:700;font-size:13px">TOTAL</td><td style="padding:10px 12px;text-align:right;font-weight:700;font-size:14px;color:#0F766E">₹${Number(totalSpend || 0).toLocaleString("en-IN")}</td></tr></tfoot></table>
  </div>
  <div class="footer">
    <div class="footer-brand">WhisperLedger</div>
    <div class="footer-note">whisperledger.support@gmail.com<br/>This is a personal expense summary. Not a bank statement.</div>
  </div>
</div>
</body></html>`;

    if (Platform.OS === "web") {
      const win = window.open("", "_blank");
      if (!win) throw new Error("Popup blocked");
      win.document.write(html);
      win.document.close();
      win.focus();
      win.print();
      return "success";
    }

    const printPromise = Print.printToFileAsync({ html, base64: false });
    const timeoutPromise = new Promise<{ uri: string }>((_, reject) =>
      setTimeout(() => reject(new Error("Timed out after 10 seconds.")), 10000)
    );
    const { uri } = await Promise.race([printPromise, timeoutPromise]);

    return await savePDFToDevice(uri, fileName, monthLabel);
  } catch (e: any) {
    console.warn("PDF generation error:", e);
    return "error";
  } finally {
    onEnd?.();
  }
}
