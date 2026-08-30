import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Alert } from "react-native";
import type { Receivable } from "@/types/receivable";
import type { Expense } from "@/context/ExpenseContext";

/**
 * Generates a formatted CSV file of money recovery cases and shares it.
 */
export async function exportReceivablesToCSV(receivables: Receivable[]): Promise<boolean> {
  try {
    if (!receivables || receivables.length === 0) {
      Alert.alert("No Data to Export", "There are no money recovery cases available to export.");
      return false;
    }

    const headers = [
      "Merchant",
      "Category",
      "Amount (INR)",
      "Status",
      "Order ID",
      "Date Initiated",
      "Expected Refund Date",
      "Promised SLA Window",
      "Notes",
    ];

    const rows = receivables.map((r) => [
      `"${(r.merchant || "").replace(/"/g, '""')}"`,
      `"${r.category}"`,
      r.amount,
      `"${r.status}"`,
      `"${r.orderId || ""}"`,
      `"${r.dateInitiated}"`,
      `"${r.expectedRefundDate}"`,
      `"${r.promisedWindow || ""}"`,
      `"${(r.notes || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

    const fileName = `WhisperLedger_Recovery_Report_${new Date().toISOString().split("T")[0]}.csv`;
    const targetFile = new File(Paths.document, fileName);
    targetFile.write(csvContent);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(targetFile.uri, {
        mimeType: "text/csv",
        dialogTitle: "Export Money Recovery Ledger",
        UTI: "public.comma-separated-values-text",
      });
      return true;
    } else {
      Alert.alert("Export Ready", `Report generated at ${fileName}`);
      return true;
    }
  } catch (error: any) {
    console.error("Export Error:", error);
    Alert.alert("Export Failed", "Unable to generate export file. Please try again.");
    return false;
  }
}

/**
 * Generates a formatted CSV file of expenses and shares it.
 */
export async function exportExpensesToCSV(expenses: Expense[]): Promise<boolean> {
  try {
    if (!expenses || expenses.length === 0) {
      Alert.alert("No Data to Export", "There are no logged expenses available to export.");
      return false;
    }

    const headers = ["Date", "Category", "Amount (INR)", "Payment Mode", "Note / Merchant"];

    const rows = expenses.map((e) => [
      `"${e.date}"`,
      `"${e.categoryId}"`,
      e.amount,
      `"${e.paymentMode || "none"}"`,
      `"${(e.note || e.merchant || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

    const fileName = `WhisperLedger_Expenses_${new Date().toISOString().split("T")[0]}.csv`;
    const targetFile = new File(Paths.document, fileName);
    targetFile.write(csvContent);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(targetFile.uri, {
        mimeType: "text/csv",
        dialogTitle: "Export Expenses Ledger",
        UTI: "public.comma-separated-values-text",
      });
      return true;
    } else {
      Alert.alert("Export Ready", `Report generated at ${fileName}`);
      return true;
    }
  } catch (error: any) {
    console.error("Export Expenses Error:", error);
    Alert.alert("Export Failed", "Unable to generate export file. Please try again.");
    return false;
  }
}
