import { cleanMerchantName } from "@/utils/smsParser";
import type { ReceivableCategory, ReceivableStatus } from "@/types/receivable";

export interface ParsedReceivableText {
  merchant: string;
  amount: number;
  category: ReceivableCategory;
  status: ReceivableStatus;
  orderId?: string;
  promisedWindow?: string;
  expectedRefundDate: string; // ISO YYYY-MM-DD
  dateInitiated: string; // ISO YYYY-MM-DD
  notes: string;
}

export function calculateDefaultSLA(merchant: string, category: ReceivableCategory): { days: number; label: string } {
  const m = merchant.toLowerCase();
  if (m.includes("swiggy") || m.includes("zomato") || m.includes("blinkit") || m.includes("zepto")) {
    return { days: 2, label: "24–48 hours" };
  }
  if (m.includes("amazon") || m.includes("flipkart") || m.includes("myntra") || m.includes("meesho") || m.includes("nykaa") || m.includes("ajio")) {
    return { days: 5, label: "3–5 business days" };
  }
  if (m.includes("makemytrip") || m.includes("goibibo") || m.includes("indigo") || m.includes("air india") || m.includes("vistara") || m.includes("irctc")) {
    return { days: 7, label: "5–7 business days" };
  }
  if (category === "upi_reversal") {
    return { days: 3, label: "24–72 hours" };
  }
  if (category === "deposit") {
    return { days: 14, label: "7–14 days" };
  }
  return { days: 5, label: "3–5 business days" };
}

function addDaysToISO(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const KNOWN_MERCHANTS: Record<string, string> = {
  AMAZON: "Amazon",
  FLIPKART: "Flipkart",
  SWIGGY: "Swiggy",
  ZOMATO: "Zomato",
  MAKEMYTRIP: "MakeMyTrip",
  GOIBIBO: "Goibibo",
  INDIGO: "IndiGo",
  VISTARA: "Vistara",
  AIRINDIA: "Air India",
  MYNTRA: "Myntra",
  NYKAA: "Nykaa",
  MEESHO: "Meesho",
  AJIO: "Ajio",
  ZARA: "Zara",
  UBER: "Uber",
  OLA: "Ola",
  RAPIDO: "Rapido",
  IRCTC: "IRCTC",
  RELIANCE: "Reliance",
  CROMA: "Croma",
};

export function parseReceivableFromText(rawText: string): ParsedReceivableText | null {
  const text = rawText.replace(/\s+/g, " ").trim();
  if (!text) return null;

  // 1. Amount matching
  const amountRegex = /(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/i;
  const amountMatch = text.match(amountRegex);
  if (!amountMatch?.[1]) return null;

  const amount = parseFloat(amountMatch[1].replace(/,/g, ""));
  if (Number.isNaN(amount) || amount <= 0) return null;

  // 2. Merchant resolution: check known merchants first
  let merchant: string | null = null;
  const upperText = text.toUpperCase();

  for (const [code, name] of Object.entries(KNOWN_MERCHANTS)) {
    if (upperText.includes(code)) {
      merchant = name;
      break;
    }
  }

  if (!merchant) {
    let rawMerchant = "Unknown Merchant";
    const merchantPatterns = [
      /(?:from|at|by|with|to|your)\s+([a-zA-Z0-9@&._\-\s*]+?)(?:\s+return|\s+refund|\s+for|\s+order|\s+ref|\s+on|\.|\n|-|$)/i,
      /(?:merchant|seller|brand)[:\s]+([a-zA-Z0-9@&._\-\s*]+?)(?:\s+on|\s+via|\.|\n|$)/i,
    ];

    for (const pattern of merchantPatterns) {
      const match = text.match(pattern);
      if (match?.[1] && match[1].trim().length > 1) {
        rawMerchant = match[1].trim();
        break;
      }
    }
    merchant = cleanMerchantName(rawMerchant);
  }

  // 3. Category & Status Determination
  let category: ReceivableCategory = "ecommerce_return";
  let status: ReceivableStatus = "REFUND_INITIATED";

  const lower = text.toLowerCase();
  if (lower.includes("cancel") || lower.includes("flight") || lower.includes("hotel") || lower.includes("booking")) {
    category = "cancellation";
    status = "REFUND_INITIATED";
  } else if (lower.includes("failed") || lower.includes("upi") || lower.includes("reversed") || lower.includes("reversal")) {
    category = "upi_reversal";
    status = "REFUND_INITIATED";
  } else if (lower.includes("deposit") || lower.includes("security")) {
    category = "deposit";
    status = "WAITING";
  } else if (lower.includes("cashback")) {
    category = "cashback";
    status = "REFUND_INITIATED";
  } else if (lower.includes("picked up") || lower.includes("pickup done") || lower.includes("pickup completed")) {
    category = "ecommerce_return";
    status = "PICKED_UP";
  } else if (lower.includes("return requested") || lower.includes("return approved") || lower.includes("schedule pickup")) {
    category = "ecommerce_return";
    status = "RETURN_REQUESTED";
  }

  // 4. Order ID / Reference ID matching
  let orderId: string | undefined = undefined;
  const orderMatch = text.match(/(?:order|ref|ticket|txn|booking|transaction)?\s*(?:id|#|num|no|number|code)\s*[:\s#]*([a-zA-Z0-9\-_]{4,30})/i);
  if (orderMatch?.[1]) {
    orderId = orderMatch[1].trim();
  }

  // 5. Date & SLA calculation
  const initiatedDate = todayISO();
  const sla = calculateDefaultSLA(merchant, category);
  const expectedDate = addDaysToISO(initiatedDate, sla.days);

  return {
    merchant,
    amount,
    category,
    status,
    orderId,
    promisedWindow: sla.label,
    dateInitiated: initiatedDate,
    expectedRefundDate: expectedDate,
    notes: text.length > 120 ? text.substring(0, 120) + "…" : text,
  };
}

/**
  Check if an incoming SMS is a Bank Credit / Reversal notification matching an active pending receivable.
*/
export function isCreditOrReversalSMS(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    (lower.includes("credited") || lower.includes("reversed") || lower.includes("refunded") || lower.includes("received")) &&
    /(?:Rs\.?|INR|₹)\s*[\d,]+/i.test(text)
  );
}
