import type { CategoryId, Expense } from "@/context/ExpenseContext";

export const MAX_CHAT_INPUT_LENGTH = 500;

export interface ChatValidationResult {
  isValid: boolean;
  cleanText: string;
  error?: string;
}

const CHAT_CATEGORIES: Array<{ id: CategoryId; label: string; aliases?: string[] }> = [
  { id: "travel", label: "Travel", aliases: ["cab", "uber", "ola", "metro", "transport"] },
  { id: "groceries", label: "Groceries", aliases: ["grocery", "vegetables", "milk", "zepto", "blinkit", "bigbasket"] },
  { id: "rent", label: "Rent", aliases: ["house rent", "flat rent", "pg"] },
  { id: "food_outside", label: "Food Outside", aliases: ["food", "restaurant", "swiggy", "zomato", "coffee", "lunch", "dinner"] },
  { id: "transfer", label: "Transfer", aliases: ["sent money", "upi transfer"] },
  { id: "utilities", label: "Utilities", aliases: ["electricity", "water", "wifi", "internet"] },
  { id: "shopping", label: "Shopping", aliases: ["amazon", "flipkart", "clothes", "myntra"] },
  { id: "health", label: "Health", aliases: ["doctor", "medicine", "pharmacy"] },
  { id: "entertainment", label: "Entertainment", aliases: ["movie", "cinema", "games"] },
  { id: "invest", label: "Investment", aliases: ["investment", "stocks", "sip", "mutual fund"] },
  { id: "education", label: "Education", aliases: ["school", "college", "course", "books"] },
  { id: "bills", label: "Bills", aliases: ["bill", "recharge", "emi"] },
  { id: "subscriptions", label: "Subscriptions", aliases: ["netflix", "spotify", "prime"] },
  { id: "personal_care", label: "Personal Care", aliases: ["salon", "haircut", "spa"] },
  { id: "gifts", label: "Gifts", aliases: ["gift", "birthday"] },
  { id: "family", label: "Family", aliases: ["parents", "kids", "children"] },
  { id: "fuel", label: "Fuel", aliases: ["petrol", "diesel", "gas"] },
  { id: "pets", label: "Pets", aliases: ["pet", "dog", "cat", "vet"] },
  { id: "other", label: "Other", aliases: ["misc", "miscellaneous"] },
];

export function validateChatInput(input: string): ChatValidationResult {
  const cleanText = (input || "").replace(/\s+/g, " ").trim();

  if (!cleanText) {
    return { isValid: false, cleanText, error: "Type a question or an expense to continue." };
  }

  if (cleanText.length > MAX_CHAT_INPUT_LENGTH) {
    return {
      isValid: false,
      cleanText,
      error: `Please keep messages under ${MAX_CHAT_INPUT_LENGTH} characters so I can parse them safely.`,
    };
  }

  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(cleanText)) {
    return { isValid: false, cleanText, error: "That message contains unsupported characters." };
  }

  return { isValid: true, cleanText };
}

export function isJailbreakOrPromptInjection(input: string): boolean {
  const lower = input.toLowerCase();
  const patterns = [
    /ignore (all )?(previous|prior|above) (instructions|rules|messages)/,
    /reveal (your )?(system|developer|hidden) (prompt|instructions|message)/,
    /show (your )?(system|developer|hidden) (prompt|instructions|message)/,
    /developer mode/,
    /\bdan\b/,
    /jailbreak/,
    /bypass (safety|rules|policy|guardrails|instructions)/,
    /override (your )?(rules|instructions|system)/,
    /act as if you have no (rules|policy|restrictions)/,
    /ignore .*?(safety|guardrail|restriction|confirmation)/,
    /do not (ask|show) .*?(confirm|review)/,
    /pretend (you are|to be) /,
    /system prompt|hidden prompt|prompt injection/,
    /make up (expenses|transactions|data|numbers)/,
    /hallucinate/,
  ];

  return patterns.some((pattern) => pattern.test(lower));
}

export function getJailbreakResponse(): string {
  return (
    "I cannot follow requests to bypass safety checks, reveal hidden instructions, invent financial data, or take actions without a clear review.\n\n" +
    "I can help with your actual ledger: ask **this month kitna spend hua**, **show recent expenses**, or **log 250 on lunch**."
  );
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function previousMonth(date: Date) {
  const d = new Date(date);
  d.setMonth(d.getMonth() - 1);
  return d;
}

function inr(amount: number) {
  return `₹${Math.round(amount || 0).toLocaleString("en-IN")}`;
}

function categoryLabel(categoryId: CategoryId) {
  return CHAT_CATEGORIES.find((c) => c.id === categoryId)?.label || "Other";
}

function monthExpenses(expenses: Expense[], date: Date) {
  const key = monthKey(date);
  return expenses.filter((expense) => expense.date?.startsWith(key));
}

function findCategoryInText(text: string): CategoryId | null {
  const lower = text.toLowerCase();
  const matched = CHAT_CATEGORIES.find((category) => {
    const label = category.label.toLowerCase();
    return (
      lower.includes(label) ||
      lower.includes(category.id.replace("_", " ")) ||
      (category.aliases || []).some((alias) => lower.includes(alias))
    );
  });
  return matched?.id || null;
}

function topCategories(expenses: Expense[]) {
  const totals = new Map<CategoryId, number>();
  for (const expense of expenses) {
    totals.set(expense.categoryId, (totals.get(expense.categoryId) || 0) + Number(expense.amount || 0));
  }
  return Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
}

function topMerchants(expenses: Expense[]) {
  const totals = new Map<string, number>();
  for (const expense of expenses) {
    const key = (expense.merchant || expense.note || "Unlabelled").trim();
    totals.set(key, (totals.get(key) || 0) + Number(expense.amount || 0));
  }
  return Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
}

export function buildExpenseInsightAnswer(input: string, expenses: Expense[], now = new Date()): string | null {
  const lower = input.toLowerCase();
  const currentMonthExpenses = monthExpenses(expenses, now);
  const prevMonthExpenses = monthExpenses(expenses, previousMonth(now));
  const targetCategory = findCategoryInText(input);

  const asksFinance =
    /spend|spent|expense|expenses|transaction|transactions|save|saving|budget|manage|advice|top|highest|recent|last|where|category|month|today|yesterday|overspend|control/i.test(
      input
    );

  if (!asksFinance) return null;

  if (expenses.length === 0) {
    return (
      "I do not have any logged expenses to analyse yet.\n\n" +
      "Start by logging transactions like **spent 200 on lunch**, then I can answer where your money is going, what changed month-to-month, and where to cut down."
    );
  }

  if (/\brecent\b|\blast\b|latest|transactions?|expense list|show/i.test(lower)) {
    const recent = expenses
      .slice()
      .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
      .slice(0, 6);

    const rows = recent
      .map((expense, idx) => {
        const label = categoryLabel(expense.categoryId);
        return `${idx + 1}. **${inr(Number(expense.amount || 0))}** - ${expense.note || label} (${label}, ${expense.date})`;
      })
      .join("\n");

    return `Here are your latest logged expenses:\n\n${rows}`;
  }

  if (targetCategory) {
    const categoryExpenses = currentMonthExpenses.filter((expense) => expense.categoryId === targetCategory);
    const total = categoryExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const monthTotal = currentMonthExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const pct = monthTotal > 0 ? Math.round((total / monthTotal) * 100) : 0;

    if (total <= 0) {
      return `You have not logged any **${categoryLabel(targetCategory)}** expenses this month.`;
    }

    const top = categoryExpenses
      .slice()
      .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
      .slice(0, 4)
      .map((expense) => `- ${inr(Number(expense.amount || 0))} on ${expense.note || categoryLabel(targetCategory)} (${expense.date})`)
      .join("\n");

    return (
      `This month you spent **${inr(total)}** on **${categoryLabel(targetCategory)}**.\n` +
      `That is **${pct}%** of your current month spend.\n\n` +
      `Biggest ${categoryLabel(targetCategory)} entries:\n${top}`
    );
  }

  const total = currentMonthExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const prevTotal = prevMonthExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const count = currentMonthExpenses.length;
  const dayOfMonth = Math.max(1, now.getDate());
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dailyAverage = total / dayOfMonth;
  const projected = dailyAverage * daysInMonth;
  const categories = topCategories(currentMonthExpenses);
  const merchants = topMerchants(currentMonthExpenses);

  if (/merchant|shop|vendor|where did i spend/i.test(lower) && merchants.length > 0) {
    const rows = merchants
      .slice(0, 5)
      .map(([merchant, amount], idx) => `${idx + 1}. **${merchant}** - ${inr(amount)}`)
      .join("\n");
    return `Your top merchants/notes this month are:\n\n${rows}`;
  }

  if (/\btop\b|highest|biggest|where.*money|category|breakdown/i.test(lower)) {
    if (categories.length === 0) return "You have no expenses logged for this month yet.";

    const rows = categories
      .slice(0, 5)
      .map(([categoryId, amount], idx) => {
        const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
        return `${idx + 1}. **${categoryLabel(categoryId)}** - ${inr(amount)} (${pct}%)`;
      })
      .join("\n");

    return `Your top spending categories this month are:\n\n${rows}`;
  }

  if (/save|saving|manage|budget|advice|control|overspend|reduce/i.test(lower)) {
    const top = categories[0];
    const second = categories[1];
    const comparison =
      prevTotal > 0
        ? total > prevTotal
          ? `You are currently **${inr(total - prevTotal)} above** last month.`
          : `You are currently **${inr(prevTotal - total)} below** last month.`
        : "I do not have enough previous-month data for a trend yet.";

    const tips = [
      top ? `Set a soft cap for **${categoryLabel(top[0])}** because it is your biggest category at ${inr(top[1])}.` : null,
      second ? `Review **${categoryLabel(second[0])}** next; it is your second-biggest category at ${inr(second[1])}.` : null,
      count > 0 ? `Your current daily average is **${inr(dailyAverage)}**. To slow spending, try staying below that number tomorrow.` : null,
      projected > total ? `At this pace, month-end spend may land near **${inr(projected)}**.` : null,
    ].filter(Boolean);

    return `Here is a grounded spending plan from your logged expenses:\n\n${comparison}\n\n${tips.map((tip) => `- ${tip}`).join("\n")}`;
  }

  const top = categories[0];
  const comparison =
    prevTotal > 0
      ? total > prevTotal
        ? `Up ${inr(total - prevTotal)} vs last month so far.`
        : `Down ${inr(prevTotal - total)} vs last month so far.`
      : "No previous-month comparison yet.";

  return (
    `This month you have spent **${inr(total)}** across ${count} transaction${count === 1 ? "" : "s"}.\n` +
    `Daily average: **${inr(dailyAverage)}**. Projected month-end: **${inr(projected)}**.\n` +
    `${comparison}` +
    (top ? `\nBiggest category: **${categoryLabel(top[0])}** at **${inr(top[1])}**.` : "")
  );
}

export function buildHouseholdAndDuesInsightAnswer(
  householdName: string,
  debtsOwedToUser: Array<{ fromName: string; amount: number }>,
  debtsOwedByUser: Array<{ toName: string; amount: number }>,
  userNetBalance: number
): string {
  if (debtsOwedToUser.length === 0 && debtsOwedByUser.length === 0) {
    return (
      `In **${householdName}**, all flat dues are completely settled! 🎉\n\n` +
      `No one owes you money, and you don't owe anyone. Clean slate!`
    );
  }

  const lines: string[] = [`Here is the balance status for **${householdName}**:\n`];

  if (userNetBalance > 0.01) {
    lines.push(`🟢 **You get back ₹${userNetBalance.toFixed(2)} in total**`);
  } else if (userNetBalance < -0.01) {
    lines.push(`🔴 **You owe ₹${Math.abs(userNetBalance).toFixed(2)} in total**`);
  }

  if (debtsOwedToUser.length > 0) {
    lines.push(`\n**Flatmates who owe you:**`);
    debtsOwedToUser.forEach((d) => {
      lines.push(`- **${d.fromName}** owes you **₹${d.amount.toFixed(2)}**`);
    });
  }

  if (debtsOwedByUser.length > 0) {
    lines.push(`\n**Money you owe:**`);
    debtsOwedByUser.forEach((d) => {
      lines.push(`- You owe **${d.toName}** **₹${d.amount.toFixed(2)}**`);
    });
  }

  lines.push(`\n💡 *Tip: To settle, just tell me "settle [amount] with [name]" or use the Settle Up button on Home!*`);
  return lines.join("\n");
}

