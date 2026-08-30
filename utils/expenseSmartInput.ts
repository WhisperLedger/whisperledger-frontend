import type { CategoryId, PaymentMode } from "@/context/ExpenseContext";

export interface SmartExpenseDraft {
  amount?: number;
  merchant?: string;
  categoryId?: CategoryId;
  paymentMode?: PaymentMode;
  cleanedNote: string;
  confidence: number;
  signals: string[];
}

type MerchantRule = {
  keys: string[];
  merchant: string;
  categoryId: CategoryId;
};

const MERCHANT_RULES: MerchantRule[] = [
  { keys: ["swiggy"], merchant: "Swiggy", categoryId: "food_outside" },
  { keys: ["zomato"], merchant: "Zomato", categoryId: "food_outside" },
  { keys: ["dominos"], merchant: "Domino's", categoryId: "food_outside" },
  { keys: ["mcdonald"], merchant: "McDonald's", categoryId: "food_outside" },
  { keys: ["kfc"], merchant: "KFC", categoryId: "food_outside" },
  { keys: ["starbucks"], merchant: "Starbucks", categoryId: "food_outside" },
  { keys: ["zepto"], merchant: "Zepto", categoryId: "groceries" },
  { keys: ["blinkit"], merchant: "Blinkit", categoryId: "groceries" },
  { keys: ["bigbasket"], merchant: "BigBasket", categoryId: "groceries" },
  { keys: ["dmart"], merchant: "DMart", categoryId: "groceries" },
  { keys: ["reliance fresh"], merchant: "Reliance Fresh", categoryId: "groceries" },
  { keys: ["amazon"], merchant: "Amazon", categoryId: "shopping" },
  { keys: ["flipkart"], merchant: "Flipkart", categoryId: "shopping" },
  { keys: ["myntra"], merchant: "Myntra", categoryId: "shopping" },
  { keys: ["nykaa"], merchant: "Nykaa", categoryId: "shopping" },
  { keys: ["croma"], merchant: "Croma", categoryId: "shopping" },
  { keys: ["uber"], merchant: "Uber", categoryId: "travel" },
  { keys: ["ola"], merchant: "Ola", categoryId: "travel" },
  { keys: ["rapido"], merchant: "Rapido", categoryId: "travel" },
  { keys: ["metro"], merchant: "Metro", categoryId: "travel" },
  { keys: ["irctc"], merchant: "IRCTC", categoryId: "travel" },
  { keys: ["netflix"], merchant: "Netflix", categoryId: "subscriptions" },
  { keys: ["spotify"], merchant: "Spotify", categoryId: "subscriptions" },
  { keys: ["prime"], merchant: "Amazon Prime", categoryId: "subscriptions" },
  { keys: ["hotstar"], merchant: "Hotstar", categoryId: "subscriptions" },
  { keys: ["youtube"], merchant: "YouTube", categoryId: "subscriptions" },
  { keys: ["bookmyshow"], merchant: "BookMyShow", categoryId: "entertainment" },
  { keys: ["pvr", "inox"], merchant: "PVR INOX", categoryId: "entertainment" },
  { keys: ["apollo"], merchant: "Apollo", categoryId: "health" },
  { keys: ["pharmeasy"], merchant: "PharmEasy", categoryId: "health" },
  { keys: ["netmeds"], merchant: "Netmeds", categoryId: "health" },
  { keys: ["healthkart"], merchant: "HealthKart", categoryId: "health" },
  { keys: ["airtel"], merchant: "Airtel", categoryId: "bills" },
  { keys: ["jio"], merchant: "Jio", categoryId: "bills" },
  { keys: ["bsnl"], merchant: "BSNL", categoryId: "bills" },
  { keys: ["tataplay"], merchant: "Tata Play", categoryId: "bills" },
  { keys: ["electricity", "bescom", "msedcl"], merchant: "Electricity", categoryId: "bills" },
];

const KEYWORD_CATEGORY_RULES: Array<{ keys: string[]; categoryId: CategoryId }> = [
  { keys: ["coffee", "lunch", "dinner", "breakfast", "pizza", "burger", "biryani", "restaurant", "cafe"], categoryId: "food_outside" },
  { keys: ["grocery", "groceries", "vegetable", "fruit", "milk"], categoryId: "groceries" },
  { keys: ["cab", "auto", "taxi", "fuel", "petrol", "diesel", "metro"], categoryId: "travel" },
  { keys: ["movie", "concert", "game", "party", "date night"], categoryId: "entertainment" },
  { keys: ["doctor", "medicine", "pharmacy", "gym"], categoryId: "health" },
  { keys: ["rent", "deposit"], categoryId: "rent" },
  { keys: ["electricity", "wifi", "broadband", "mobile bill", "water bill"], categoryId: "bills" },
  { keys: ["course", "book", "college", "school", "tuition"], categoryId: "education" },
  { keys: ["sip", "mutual fund", "stock", "investment"], categoryId: "invest" },
];

function titleCase(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function firstKeywordMatch<T extends { keys: string[] }>(rules: T[], lower: string): T | undefined {
  return rules.find((rule) => rule.keys.some((key) => lower.includes(key)));
}

export function inferPaymentMode(input: string): PaymentMode | undefined {
  const lower = input.toLowerCase();
  if (/\b(cash|paid cash)\b/.test(lower)) return "cash";
  if (/\b(card|credit card|debit card|visa|mastercard)\b/.test(lower)) return "card";
  if (/\b(netbanking|net banking|bank transfer|imps|neft)\b/.test(lower)) return "netbanking";
  if (/\b(upi|gpay|google pay|phonepe|paytm|bhim)\b/.test(lower)) return "upi";
  return undefined;
}

export function inferExpenseDraft(input: string): SmartExpenseDraft {
  const raw = input.trim();
  const lower = raw.toLowerCase();
  const signals: string[] = [];

  const currencyAmount = raw.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i);
  const plainAmount = raw.match(/\b([\d,]+(?:\.\d{1,2})?)\b/);
  const amountText = currencyAmount?.[1] || plainAmount?.[1];
  const amount = amountText ? Number(amountText.replace(/,/g, "")) : undefined;
  if (amount && amount > 0) signals.push("amount");

  const merchantRule = firstKeywordMatch(MERCHANT_RULES, lower);
  const keywordRule = firstKeywordMatch(KEYWORD_CATEGORY_RULES, lower);
  const paymentMode = inferPaymentMode(raw);
  if (merchantRule) signals.push("merchant");
  if (merchantRule?.categoryId || keywordRule?.categoryId) signals.push("category");
  if (paymentMode) signals.push("payment");

  const atMatch = raw.match(/\b(?:at|to|from)\s+([a-zA-Z][a-zA-Z0-9&.\s-]{2,28})(?:\s+(?:for|via|using|on|rs|inr|₹)|$)/i);
  const merchant = merchantRule?.merchant || (atMatch?.[1] ? titleCase(atMatch[1]) : undefined);
  if (merchant && !signals.includes("merchant")) signals.push("merchant");

  const cleanedNote = raw
    .replace(/(?:rs\.?|inr|₹)\s*[\d,]+(?:\.\d{1,2})?/i, "")
    .replace(/\bspent\b|\bpaid\b|\blog\b|\badd\b|\bexpense\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    amount: amount && amount > 0 ? amount : undefined,
    merchant,
    categoryId: merchantRule?.categoryId || keywordRule?.categoryId,
    paymentMode,
    cleanedNote: cleanedNote || raw,
    confidence: Math.min(1, signals.length / 4),
    signals,
  };
}
