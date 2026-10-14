import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";

import { CATEGORIES, CategoryId, Expense, useExpenses, PaymentMode } from "@/context/ExpenseContext";
import { useHousehold } from "@/context/HouseholdContext";
import { useReceivables } from "@/context/ReceivablesContext";
import { useAuth } from "@/context/AuthContext";
import { useSubscription } from "@/context/SubscriptionContext";
import { useColors } from "@/hooks/useColors";
import { safeHaptics } from "@/utils/haptics";
import * as Haptics from "expo-haptics";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import {
  buildExpenseInsightAnswer,
  buildHouseholdAndDuesInsightAnswer,
  getJailbreakResponse,
  isJailbreakOrPromptInjection,
  MAX_CHAT_INPUT_LENGTH,
  validateChatInput,
} from "@/utils/chatbotIntelligence";
import { appGradients, iconSurface, surfaceStyle } from "@/utils/designSystem";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── Markdown renderer ───────────────────────────────────────────────────────
function renderMarkdown(text: string, baseStyle: any, boldColor?: string) {
  const parts: { text: string; bold: boolean; italic: boolean }[] = [];
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex)
      parts.push({ text: text.slice(lastIndex, match.index), bold: false, italic: false });
    if (match[1] !== undefined) parts.push({ text: match[1], bold: true, italic: false });
    else if (match[2] !== undefined) parts.push({ text: match[2], bold: false, italic: true });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length)
    parts.push({ text: text.slice(lastIndex), bold: false, italic: false });
  return (
    <Text style={baseStyle}>
      {parts.map((p, i) => (
        <Text
          key={i}
          style={[
            baseStyle,
            p.bold && { fontWeight: "700", color: boldColor || baseStyle.color },
            p.italic && { fontStyle: "italic" },
          ]}
        >
          {p.text}
        </Text>
      ))}
    </Text>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  sender: "user" | "bot";
  text: string;
  timestamp: Date;
  customCard?: {
    type: "expense_success" | "budget_analysis" | "support_success" | "help_guide";
    title: string;
    body: string;
    metadata?: any;
  };
}

interface ParsedExpense {
  amount: number;
  categoryId: CategoryId;
  note: string;
  date: string;
  paymentMode?: PaymentMode;
}

const MIN_SUPPORT_MESSAGE_LENGTH = 12;
const MAX_BULK_EXPENSES = 20;
const MAX_EXPENSE_AMOUNT = 10_000_000;

interface ConvState {
  step: "idle" | "awaiting_category" | "awaiting_support_desc" | "awaiting_support_confirmation" | "awaiting_confirmation" | "awaiting_bulk_confirmation" | "awaiting_edit_review" | "awaiting_edit_final";
  amount?: number;
  categoryId?: CategoryId;
  note?: string;
  date?: string;
  bulkExpenses?: ParsedExpense[];
  supportMessage?: string;
  editExpenseId?: string;
  editOriginalAmount?: number;
  editNewAmount?: number;
}

const AFFIRMATIVE_REPLIES = new Set(["yes", "yeah", "y", "ok", "okay", "sure", "confirm", "save", "haan", "ha", "haanji", "bilkul", "ji", "हाँ", "हां", "जी", "✅", "👍"]);
const NEGATIVE_REPLIES = new Set(["no", "n", "nope", "cancel", "discard", "stop", "nahi", "nahin", "mat karo", "नहीं", "नही", "मत", "❌", "👎"]);
const isAffirmativeReply = (value: string) => AFFIRMATIVE_REPLIES.has(value.trim().toLowerCase());
const isNegativeReply = (value: string) => NEGATIVE_REPLIES.has(value.trim().toLowerCase());

// ─── Category keywords ────────────────────────────────────────────────────────
const CATEGORY_KEYWORDS: Record<CategoryId, string[]> = {
  travel: ["travel","taxi","cab","uber","ola","flight","train","bus","ticket","fuel","petrol","diesel","auto","metro","safar","rickshaw","यात्रा"],
  groceries: ["grocery","groceries","supermarket","milk","egg","veg","vegetable","fruit","reliance","blinkit","zepto","instamart","bazaar","mart","rashan","sabzi","kirana","राशन","सब्जी"],
  rent: ["rent","lease","landlord","flat","room","pg"],
  maid_cook: ["maid","cook","househelp","house help","bai","cleaning","chef","kamwali","cook salary","maid salary"],
  food_outside: ["food","restaurant","swiggy","zomato","cafe","coffee","starbucks","tea","lunch","dinner","breakfast","pizza","burger","biryani","dhaba","khana","chai","nashta","खाना","चाय","नाश्ता"],
  transfer: ["transfer","send","sent","wire","gpay","phonepe","paytm"],
  utilities: ["utility","utilities","electricity","water","gas","internet","wifi","broadband","power"],
  shopping: ["shopping","clothes","dress","shoe","shoes","amazon","flipkart","myntra","zara","h&m"],
  health: ["health","doctor","medicine","hospital","pharmacy","medical","clinic","checkup"],
  entertainment: ["movie","film","cinema","theatre","show","concert","game","gaming","party","clubbing"],
  invest: ["invest","investment","stock","mutual fund","sip","crypto","shares","equity"],
  education: ["education","school","college","fees","book","books","course","tuition"],
  bills: ["bill","recharge","mobile","dth","broadband","payment"],
  subscriptions: ["netflix","spotify","youtube","premium","subscription","prime","hotstar"],
  personal_care: ["personal care","scissors","salon","spa","haircut","makeup","parlour"],
  gifts: ["gift","gifts","present","birthday","anniversary","wedding"],
  family: ["family","home","parents","wife","child","children","kid","kids"],
  fuel: ["fuel","truck","petrol","diesel","gasoline"],
  pets: ["pet","pets","dog","cat","vet","pedigree"],
  other: ["other","misc","miscellaneous","cash"],
};

// ─── Note extraction ──────────────────────────────────────────────────────────
// Only keep meaningful descriptive words, strip all action/amount words
function extractNote(text: string, amount: number): string {
  const stopWords = new Set([
    "i","me","my","the","a","an","and","or","but","in","on","at","to","for",
    "of","with","by","from","up","about","into","then","that","this","is","are",
    "was","were","have","has","had","do","did","will","would","can","could",
    "should","may","might","shall","spent","add","log","pay","paid","cost",
    "worth","rupees","rs","inr","on","for","today","yesterday","now","just",
    "please","pls","kindly","note","description","under","category","some",
    "amount","money","bucks","paisa",
  ]);

  return text
    .replace(new RegExp(`\\b${amount}\\b`, "g"), "")
    .replace(/[₹\d,]+(\.\d{1,2})?/g, "")
    .replace(/\b(spent|add|log|pay|paid|cost|worth|rupees|rs\.?|inr|₹|on|for|today|yesterday|please|pls|kindly|note|description|under|category)\b/gi, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w.toLowerCase()))
    .slice(0, 4) // max 4 meaningful words
    .join(" ")
    .trim();
}

// ─── Helper utilities for date and transaction parsing ────────────────────────
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isValidISODateParts(year: number, month: number, day: number) {
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function parseTransactionLine(line: string, fallbackDate?: string): (ParsedExpense & { dateExplicitlyMatched: boolean }) | null {
  const lower = line.toLowerCase().trim();
  if (!lower) return null;

  // 1. Parse Amount
  const amountRegex = /(?:spent|spend|spended|add|log|pay|paid|buying|bought|buy|cost|worth|rupees|ruppes|rupee|rs\.?|inr|₹|bucks|kharch|kharcha|diye|diya|liye)\s*([\d,]+(?:\.\d{1,2})?)|([,\d]+(?:\.\d{1,2})?)\s*(?:rupees|ruppes|rupee|rs\.?|inr|₹|bucks|spent|spend|kharch|ka|ke|kiye)/i;
  const amountMatch = line.match(amountRegex) || line.match(/\b(\d+(?:\.\d{1,2})?)\b/);
  if (!amountMatch) return null;

  const rawAmt = amountMatch[1] || amountMatch[2] || amountMatch[0];
  const amount = parseFloat(rawAmt.replace(/,/g, ""));
  if (isNaN(amount) || amount <= 0 || amount > MAX_EXPENSE_AMOUNT) return null;

  // 2. Parse Date
  let date = fallbackDate || todayISO();
  let matchedDateText = "";
  let dateExplicitlyMatched = false;

  if (/\b(today|aaj)\b|आज/i.test(line)) {
    date = todayISO();
    matchedDateText = /आज/i.test(line) ? "आज" : /\baaj\b/i.test(line) ? "aaj" : "today";
    dateExplicitlyMatched = true;
  // "Kal" can mean either yesterday or tomorrow in Hindi/Hinglish. Do not
  // infer a financial date from it; the review screen must use an unambiguous
  // date before an expense can be saved.
  } else if (/\byesterday\b/i.test(line)) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    matchedDateText = "yesterday";
    dateExplicitlyMatched = true;
  } else if (/\b(day before yesterday)\b/i.test(line)) {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    matchedDateText = "day before yesterday";
    dateExplicitlyMatched = true;
  } else {
    const dmyRegex = /\b(\d{1,2})[\/\-\.](\d{1,2})(?:[\/\-\.](\d{2,4}))?\b/;
    const dmyMatch = line.match(dmyRegex);
    if (dmyMatch) {
      let day = parseInt(dmyMatch[1], 10);
      let month = parseInt(dmyMatch[2], 10);
      let year = dmyMatch[3] ? parseInt(dmyMatch[3], 10) : new Date().getFullYear();
      if (year < 100) year += 2000;
      if (isValidISODateParts(year, month, day)) {
        date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        matchedDateText = dmyMatch[0];
        dateExplicitlyMatched = true;
      }
    } else {
      const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
      const monthsFull = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
      
      let foundMonthIdx = -1;
      let monthKeyword = "";
      for (let i = 0; i < 12; i++) {
        if (lower.includes(monthsFull[i])) {
          foundMonthIdx = i;
          monthKeyword = monthsFull[i];
          break;
        } else if (lower.includes(months[i])) {
          foundMonthIdx = i;
          monthKeyword = months[i];
          break;
        }
      }

      if (foundMonthIdx !== -1) {
        const regexAround = new RegExp(`(\\b\\d{1,2}(?:st|nd|rd|th)?\\b)?\\s*${monthKeyword}\\s*(\\b\\d{1,2}(?:st|nd|rd|th)?\\b)?(?:\\s*,?\\s*(\\b\\d{2,4}\\b))?`, "i");
        const matchAround = line.match(regexAround);
        if (matchAround) {
          const rawDay = matchAround[1] || matchAround[2];
          const rawYear = matchAround[3];
          if (rawDay) {
            const day = parseInt(rawDay.replace(/(st|nd|rd|th)/g, ""), 10);
            let year = rawYear ? parseInt(rawYear, 10) : new Date().getFullYear();
            if (year < 100) year += 2000;
            if (isValidISODateParts(year, foundMonthIdx + 1, day)) {
              date = `${year}-${String(foundMonthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              matchedDateText = matchAround[0];
              dateExplicitlyMatched = true;
            }
          }
        }
      }
    }
  }

  // 3. Category Detection
  let matchedCat: CategoryId | null = null;
  for (const [catId, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) { matchedCat = catId as CategoryId; break; }
  }
  if (!matchedCat) {
    const lm = CATEGORIES.find((c) => lower.includes(c.label.toLowerCase()));
    if (lm) matchedCat = lm.id;
  }
  if (!matchedCat) matchedCat = "other";

  // 4. Payment Mode Detection
  let matchedPaymentMode: PaymentMode = "upi";
  const bracketMatch = line.match(/[\(\[\{]([a-zA-Z\s\d]+)[\)\]\}]/);
  if (bracketMatch) {
    const bracketContent = bracketMatch[1].toLowerCase().trim();
    if (bracketContent.includes("upi") || bracketContent.includes("gpay") || bracketContent.includes("phonepe") || bracketContent.includes("paytm")) {
      matchedPaymentMode = "upi";
    } else if (bracketContent.includes("card") || bracketContent.includes("credit") || bracketContent.includes("debit")) {
      matchedPaymentMode = "card";
    } else if (bracketContent.includes("cash")) {
      matchedPaymentMode = "cash";
    } else if (bracketContent.includes("netbanking") || bracketContent.includes("bank") || bracketContent.includes("net banking") || bracketContent.includes("transfer")) {
      matchedPaymentMode = "netbanking";
    }
  } else {
    if (/\b(card|credit|debit)\b/i.test(line)) {
      matchedPaymentMode = "card";
    } else if (/\b(cash)\b/i.test(line)) {
      matchedPaymentMode = "cash";
    } else if (/\b(netbanking|bank|transfer)\b/i.test(line)) {
      matchedPaymentMode = "netbanking";
    } else if (/\b(upi|gpay|phonepe|paytm)\b/i.test(line)) {
      matchedPaymentMode = "upi";
    }
  }

  // 5. Note Extraction
  let cleanNote = line;
  if (bracketMatch) {
    cleanNote = cleanNote.replace(bracketMatch[0], "");
  }
  if (matchedDateText) cleanNote = cleanNote.replace(matchedDateText, "");
  cleanNote = cleanNote.replace(amountMatch[0], "");
  
  const catLabel = CATEGORIES.find((c) => c.id === matchedCat)?.label || "Other";
  let note = extractNote(cleanNote, amount);
  if (!note || note.length < 2) note = catLabel;

  return {
    amount,
    categoryId: matchedCat,
    note,
    date,
    paymentMode: matchedPaymentMode,
    dateExplicitlyMatched
  };
}

function extractDateFromText(text: string): string | null {
  const lower = text.toLowerCase();
  
  if (/\b(today)\b/i.test(text)) {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  if (/\b(yesterday)\b/i.test(text)) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  if (/\b(day before yesterday)\b/i.test(text)) {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  // Numeric formats: DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY, YYYY-MM-DD
  const dmyRegex = /\b(\d{1,2})[\/\-\.](\d{1,2})(?:[\/\-\.](\d{2,4}))?\b/;
  const dmyMatch = text.match(dmyRegex);
  if (dmyMatch) {
    let day = parseInt(dmyMatch[1], 10);
    let month = parseInt(dmyMatch[2], 10);
    let year = dmyMatch[3] ? parseInt(dmyMatch[3], 10) : new Date().getFullYear();
    if (year < 100) year += 2000;
    if (isValidISODateParts(year, month, day)) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // Month names
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const monthsFull = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  
  let foundMonthIdx = -1;
  let monthKeyword = "";
  for (let i = 0; i < 12; i++) {
    if (lower.includes(monthsFull[i])) {
      foundMonthIdx = i;
      monthKeyword = monthsFull[i];
      break;
    } else if (lower.includes(months[i])) {
      foundMonthIdx = i;
      monthKeyword = months[i];
      break;
    }
  }

  if (foundMonthIdx !== -1) {
    const regexAround = new RegExp(`(\\b\\d{1,2}(?:st|nd|rd|th)?\\b)?\\s*${monthKeyword}\\s*(\\b\\d{1,2}(?:st|nd|rd|th)?\\b)?(?:\\s*,?\\s*(\\b\\d{2,4}\\b))?`, "i");
    const matchAround = text.match(regexAround);
    if (matchAround) {
      const rawDay = matchAround[1] || matchAround[2];
      const rawYear = matchAround[3];
      if (rawDay) {
        const day = parseInt(rawDay.replace(/(st|nd|rd|th)/g, ""), 10);
        let year = rawYear ? parseInt(rawYear, 10) : new Date().getFullYear();
        if (year < 100) year += 2000;
        if (isValidISODateParts(year, foundMonthIdx + 1, day)) {
          return `${year}-${String(foundMonthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        }
      }
    }
  }

  return null;
}

type ExpenseEditRequest = { expense: Expense; newAmount: number };

/**
 * Finds one personal expense for an amount-only edit. Ambiguity is intentional:
 * the assistant refuses to guess when more than one record could match.
 */
function findExpenseEditRequest(text: string, expenses: Expense[]): ExpenseEditRequest | null | "ambiguous" {
  const amountChange = text.match(/\bfrom\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)\s*(?:to|into)\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)/i)
    || text.match(/\bto\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (!amountChange) return null;

  const sourceAmount = amountChange.length > 2 && amountChange[2] ? Number(amountChange[1].replace(/,/g, "")) : undefined;
  const targetAmount = Number((amountChange.length > 2 && amountChange[2] ? amountChange[2] : amountChange[1]).replace(/,/g, ""));
  if (!Number.isFinite(targetAmount) || targetAmount <= 0 || targetAmount > MAX_EXPENSE_AMOUNT) return null;

  const requestedDate = extractDateFromText(text);
  const searchTerms = text
    .toLowerCase()
    .replace(/\b(edit|change|update|correct|modify|expense|transaction|payment|entry|from|to|into|rs\.?|inr)\b/g, " ")
    .replace(/[₹\d,]+(?:\.\d{1,2})?/g, " ")
    .split(/\s+/)
    .filter((term) => term.length > 2);

  const matches = expenses.filter((expense) => {
    if (expense.householdExpenseId || expense.isHouseholdSplitShare) return false;
    if (sourceAmount !== undefined && Math.abs(expense.amount - sourceAmount) > 0.01) return false;
    if (requestedDate && expense.date !== requestedDate) return false;
    const searchable = `${expense.note} ${expense.merchant || ""} ${CATEGORIES.find((c) => c.id === expense.categoryId)?.label || ""}`.toLowerCase();
    return searchTerms.length === 0 || searchTerms.every((term) => searchable.includes(term));
  });

  if (matches.length !== 1) return matches.length > 1 ? "ambiguous" : null;
  return { expense: matches[0], newAmount: targetAmount };
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ChatbotScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { user } = useAuth();
  const { addExpense, addMultipleExpenses, getCategoryTotalsForMonth, getTotalForMonth, expenses, updateExpense } = useExpenses();
  const { getPendingReceivables, getTotalPendingAmount } = useReceivables();
  const {
    currentHousehold,
    balances,
    pairwiseDebts,
    userNetBalance,
  } = useHousehold();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [typing, setTyping] = useState(false);
  const [convState, setConvState] = useState<ConvState>({ step: "idle" });
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("");

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const finalVoiceResultHandledRef = useRef(false);
  const latestVoiceTranscriptRef = useRef("");
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const gradients = appGradients(colors);

  useSpeechRecognitionEvent("start", () => {
    finalVoiceResultHandledRef.current = false;
    latestVoiceTranscriptRef.current = "";
    setIsListening(true);
    setVoiceStatus("Listening...");
  });

  useSpeechRecognitionEvent("end", () => {
    setIsListening(false);
    setVoiceStatus("");
    if (!finalVoiceResultHandledRef.current && latestVoiceTranscriptRef.current.trim()) {
      finalVoiceResultHandledRef.current = true;
      const transcript = latestVoiceTranscriptRef.current.trim();
      latestVoiceTranscriptRef.current = "";
      setInputText("");
      void submitMessage(transcript);
    }
  });

  useSpeechRecognitionEvent("result", (event) => {
    const transcript = event.results[0]?.transcript?.trim() || "";
    if (!transcript) return;

    latestVoiceTranscriptRef.current = transcript;
    setInputText(transcript);
    setVoiceStatus(event.isFinal ? "Processing voice command..." : `🎙 Listening: "${transcript}"`);

    if (event.isFinal && !finalVoiceResultHandledRef.current) {
      finalVoiceResultHandledRef.current = true;
      latestVoiceTranscriptRef.current = "";
      setInputText("");
      void submitMessage(transcript);
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    finalVoiceResultHandledRef.current = false;
    setIsListening(false);
    setVoiceStatus("");

    const message =
      event.error === "not-allowed"
        ? "Microphone permission is required for voice commands."
        : event.error === "no-speech" || event.error === "speech-timeout"
          ? "I could not hear anything. Tap the mic and try again."
          : event.error === "network"
            ? "Speech recognition needs network or an on-device recognizer. Please try again."
            : event.message || "Voice command failed. Please try again.";

    addMessage("bot", message);
  });

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardHeight(0)
    );
    return () => { show.remove(); hide.remove(); };
  }, []);

  // Welcome message
  useEffect(() => {
    const firstName = user?.name?.split(" ")[0] || "friend";
    const hour = new Date().getHours();
    const g = hour < 12 ? "Good morning" : hour < 17 ? "Hey" : "Good evening";
    setMessages([{
      id: "welcome",
      sender: "bot",
      text: `${g}, ${firstName}. I work only with the information in your WhisperLedger.\n\nYou can log a personal expense, ask about your recorded spending, or get help using the app. I show a review before saving anything, and I never create shared expenses or settlements from chat.\n\nTry: “Aaj chai pe 80 kharch hue”, “Is month kitna spend hua?”, or “Change coffee from 120 to 150”.`,
      timestamp: new Date(),
    }]);
  }, [user]);

  const addMessage = useCallback((sender: "user" | "bot", text: string, card?: Message["customCard"]) => {
    setMessages((prev) => [
      ...prev,
      { id: Math.random().toString(), sender, text, timestamp: new Date(), customCard: card },
    ]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const submitMessage = useCallback((rawText: string) => {
    const validation = validateChatInput(rawText);
    const clean = validation.cleanText;
    if (!validation.isValid) {
      if (validation.error) addMessage("bot", validation.error);
      return;
    }

    addMessage("user", clean);
    setTyping(true);
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => processUserMessage(clean), 800);
  }, [addMessage, processUserMessage]);

  const handleSend = async () => {
    const clean = inputText;
    setInputText("");
    submitMessage(clean);
  };

  const { requirePro } = useSubscription();

  const handleVoiceCommand = async () => {
    if (!requirePro("AI Voice Auto-Logging")) return;
    if (isListening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }

    try {
      const available = ExpoSpeechRecognitionModule.isRecognitionAvailable();
      if (!available) {
        addMessage("bot", "Voice commands are not available on this device. Please type your message instead.");
        return;
      }

      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        addMessage("bot", "Please allow microphone and speech recognition permissions to use voice commands.");
        return;
      }

      finalVoiceResultHandledRef.current = false;
      setVoiceStatus("Listening...");
      ExpoSpeechRecognitionModule.start({
        lang: "en-IN",
        interimResults: true,
        continuous: false,
        maxAlternatives: 1,
        contextualStrings: [
          "spent 200 on lunch",
          "log 500 groceries",
          "where can I save money",
          "show recent expenses",
          "top spending categories",
          "download statement",
          "raise support ticket",
        ],
      });
    } catch (error: any) {
      setIsListening(false);
      setVoiceStatus("");
      addMessage("bot", error?.message || "Voice command could not start. Please try typing instead.");
    }
  };

  // ─── AGENT: multi-task detection ──────────────────────────────────────────
  // Returns a list of detected intent tokens from user message
  function detectIntents(lower: string): string[] {
    const intents: string[] = [];

    // Abuse check first
    const abusiveWords = ["fuck","shit","bastard","bitch","asshole","idiot","stupid","dumb","moron",
      "bc","mc","chutiya","madarchod","bhenchod","harami","sala","gandu","randi","kamine","bkl","mf"];
    if (abusiveWords.some((w) => lower.includes(w))) intents.push("abuse");

    // Support — must be checked before "help" to avoid cheatsheet conflict
    if (
      (lower.includes("raise") && (lower.includes("support") || lower.includes("ticket"))) ||
      lower.includes("report issue") ||
      lower.includes("i have a problem") ||
      lower.includes("i have an issue") ||
      lower.includes("complaint") ||
      (lower.includes("need help") && lower.includes("support")) ||
      lower === "support"
    ) intents.push("support");

    const isEditRequest =
      /\b(edit|change|update|correct|modify)\b/i.test(lower) &&
      (/\b(expense|transaction|payment|entry)\b/i.test(lower) || /\b(from|to)\s*(?:₹|rs\.?|inr)?\s*\d/i.test(lower));
    if (isEditRequest) intents.push("edit_expense");

    // Expense log. Detect this before analytics so "spent 150 on lunch" does not become a report query.
    const expenseRegex = /(?:spent|spend|spended|paid|pay|buying|bought|buy|add|log|cost|worth|₹|rs\.?\s*\d|\d\s*rs\.?|inr)\s*[\d,]+|[\d,]+\s*(?:rupees|ruppes|rupee|rs\.?|inr|₹|bucks)/i;
    const isExpenseLog = expenseRegex.test(lower) || parseTransactionLine(lower) !== null;
    if (isExpenseLog && !isEditRequest) intents.push("expense");

    // PDF / statement
    if (lower.includes("pdf") || lower.includes("statement") || lower.includes("download report") ||
      lower.includes("download my") || lower.includes("get report") || lower.includes("generate pdf"))
      intents.push("pdf");

    // Universal spend and analysis query
    const queryPhrases = [
      "how much", "spending", "spent", "total for", "kitna spend", "kitna kharch", "kitna hua", "kharcha", "कितना", "खर्च", "my spend",
      "what did i spend", "expense list", "show transaction", "tell me my spend",
      "analyse", "analyze", "breakdown", "overview", "monthly report", "how am i doing", 
      "show spending", "show budget", "where can i save", "manage my money", "spending advice",
      "top category", "highest expense", "recent expenses", "last transactions", "control spending"
    ];
    if (!isExpenseLog && queryPhrases.some((p) => lower.includes(p))) {
      intents.push("spend_query");
    }

    // Greeting
    const greetWords = ["hi","hello","hey","namaste","hii","hlo","gm","good morning","good evening","good night"];
    if (!intents.length && greetWords.some((g) => lower === g || lower.startsWith(g + " ") || lower.endsWith(" " + g)))
      intents.push("greeting");

    // Mood
    const sadWords = ["sad","depressed","upset","stressed","anxious","worried","lonely","bored","dukhi","pareshan"];
    if (sadWords.some((w) => lower.includes(w))) intents.push("sad");
    const happyWords = ["happy","excited","great day","awesome","fantastic","khush","mast","blessed"];
    if (happyWords.some((w) => lower.includes(w))) intents.push("happy");

    // Joke
    if (lower.includes("joke") || lower.includes("funny") || lower.includes("make me laugh") || lower.includes("entertain")) intents.push("joke");

    // Thanks
    if (lower.includes("thank") || lower.includes("shukriya") || lower.includes("love you") || lower.includes("good bot") || lower.includes("great bot")) intents.push("thanks");

    // Motivation
    if (lower.includes("motivat") || lower.includes("inspire") || lower.includes("i give up") || lower.includes("feeling lost") || lower.includes("advice")) intents.push("motivate");

    // How are you
    if (lower.includes("how are you") || lower.includes("how r u") || lower.includes("wassup") ||
      lower.includes("whats up") || lower.includes("what's up") || lower.includes("kya haal") || lower.includes("kaisa"))
      intents.push("how_are_you");

    // Security/privacy
    if (lower.includes("secure") || lower.includes("privacy") || lower.includes("safe") || lower.includes("data safe")) intents.push("security");

    // SMS sync
    if (lower.includes("sms") || lower.includes("auto detect") || lower.includes("auto sync") || lower.includes("संदेश")) intents.push("sms");

    // Profile settings guidance
    if (
      lower.includes("change name") || lower.includes("edit name") || lower.includes("update name") || lower.includes("set name") ||
      lower.includes("change username") || lower.includes("set username") ||
      lower.includes("profile picture") || lower.includes("profile photo") || lower.includes("avatar") ||
      lower.includes("change picture") || lower.includes("change photo") ||
      lower.includes("auto-sync") || lower.includes("auto sync") || lower.includes("gpay sync") || lower.includes("sms sync") ||
      lower.includes("sign out") || lower.includes("logout") || lower.includes("theme") || lower.includes("light mode") || lower.includes("dark mode")
    ) intents.push("profile_guide");

    // Ledger / expense management guidance
    if (!isEditRequest && (
      lower.includes("delete expense") || lower.includes("delete transaction") || lower.includes("remove expense") || lower.includes("remove transaction") ||
      lower.includes("edit expense") || lower.includes("edit transaction") || lower.includes("change expense") || lower.includes("change transaction") ||
      lower.includes("update transaction") || lower.includes("correct transaction") || lower.includes("modify transaction") || lower.includes("delete log")
    )) intents.push("ledger_guide");

    // Money Recovery intent
    if (
      lower.includes("where is my money") || lower.includes("pending refund") ||
      lower.includes("refund") || lower.includes("stuck money") || lower.includes("deposit") ||
      lower.includes("reversal") || lower.includes("recovery agent") ||
      lower.includes("return money") || lower.includes("swiggy") || lower.includes("zepto") ||
      lower.includes("zomato") || lower.includes("blinkit") || lower.includes("amazon") ||
      lower.includes("flight") || lower.includes("claim") || lower.includes("overdue")
    ) intents.push("money_recovery");

    // Household Split
    if (
      lower.includes("split") ||
      (lower.includes("flat") && (lower.includes("bill") || lower.includes("spend") || lower.includes("grocery") || lower.includes("maid") || lower.includes("cook") || lower.includes("wifi")))
    ) intents.push("household_split");

    // Household Settle
    if (
      lower.includes("settle") ||
      lower.includes("clear dues") ||
      lower.includes("paid flatmate") ||
      lower.includes("received from")
    ) intents.push("household_settle");

    // Household Dues Query
    if (
      lower.includes("flat status") ||
      lower.includes("haveli status") ||
      lower.includes("household balance") ||
      lower.includes("who owes") ||
      lower.includes("who all owe") ||
      lower.includes("do i owe") ||
      lower.includes("flat dues") ||
      lower.includes("flat balance")
    ) intents.push("household_dues_query");

    // Help / cheatsheet — only if no other intents
    if (!intents.length && (lower.includes("help") || lower === "/help" || lower.includes("what can you do") || lower.includes("commands")))
      intents.push("help");

    if (
      lower.includes("how to use app") ||
      lower.includes("complete app") ||
      lower.includes("one stop") ||
      lower.includes("what all can you do") ||
      lower.includes("guide me") ||
      lower.includes("app guide")
    ) intents.push("app_guide");

    return intents;
  }

  // ─── MAIN PROCESSOR ───────────────────────────────────────────────────────
  async function processUserMessage(text: string) {
    const lower = text.toLowerCase().trim();
    const firstName = user?.name?.split(" ")[0] || "friend";

    if (isJailbreakOrPromptInjection(text)) {
      addMessage("bot", getJailbreakResponse());
      setTyping(false);
      return;
    }

    // Editing a ledger entry has two separate, explicit approvals. This keeps a
    // conversational typo from changing a financial record.
    if (convState.step === "awaiting_edit_review") {
      if (isNegativeReply(lower)) {
        setConvState({ step: "idle" });
        addMessage("bot", "No changes were made.");
        setTyping(false);
        return;
      }
      if (!isAffirmativeReply(lower)) {
        addMessage("bot", "Please reply **Yes** to continue to the final check, or **Cancel** to keep the expense unchanged.");
        setTyping(false);
        return;
      }
      setConvState({
        step: "awaiting_edit_final",
        editExpenseId: convState.editExpenseId,
        editOriginalAmount: convState.editOriginalAmount,
        editNewAmount: convState.editNewAmount,
      });
      addMessage("bot", `Final check: this will change the amount to **₹${convState.editNewAmount?.toLocaleString("en-IN")}**. Reply **Update** to save it, or **Cancel** to stop.`);
      setTyping(false);
      return;
    }

    if (convState.step === "awaiting_edit_final") {
      if (isNegativeReply(lower)) {
        setConvState({ step: "idle" });
        addMessage("bot", "No changes were made.");
        setTyping(false);
        return;
      }
      if (lower !== "update") {
        addMessage("bot", "For safety, reply **Update** to save this change, or **Cancel** to stop.");
        setTyping(false);
        return;
      }

      const currentExpense = expenses.find((expense) => expense.id === convState.editExpenseId);
      if (!currentExpense || currentExpense.householdExpenseId || currentExpense.isHouseholdSplitShare) {
        setConvState({ step: "idle" });
        addMessage("bot", "That expense is no longer available for a safe edit. Please open History and review it there.");
        setTyping(false);
        return;
      }
      if (Math.abs(currentExpense.amount - (convState.editOriginalAmount || 0)) > 0.01) {
        setConvState({ step: "idle" });
        addMessage("bot", "That expense changed while we were checking it, so I did not overwrite it. Please start again with the latest value.");
        setTyping(false);
        return;
      }

      try {
        await updateExpense(currentExpense.id, { amount: convState.editNewAmount! });
        safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        addMessage("bot", `Updated. **${currentExpense.note || "Expense"}** is now **₹${convState.editNewAmount?.toLocaleString("en-IN")}**.`);
      } catch (error: any) {
        addMessage("bot", `I could not update that expense. ${error?.message || "Please try again from History."}`);
      } finally {
        setConvState({ step: "idle" });
        setTyping(false);
      }
      return;
    }

    // ── Context: awaiting support description ──────────────────────────────
    if (convState.step === "awaiting_support_desc") {
      if (text.trim().length < MIN_SUPPORT_MESSAGE_LENGTH) {
        addMessage("bot", `Please add a little more detail before I file the ticket — what happened, where in the app, and what you expected.`);
        setTyping(false);
        return;
      }

      setConvState({ step: "awaiting_support_confirmation", supportMessage: text });
      addMessage("bot", `I can send this to support:\n\n“${text}”\n\nReply **Confirm** to submit it, or **Cancel** to keep it private.`);
      setTyping(false);
      return;
    }

    // Support tickets communicate a user message externally, so always require
    // an explicit confirmation after showing the exact text that will be sent.
    if (convState.step === "awaiting_support_confirmation") {
      if (isNegativeReply(lower)) {
        setConvState({ step: "idle" });
        addMessage("bot", "Cancelled. I did not send anything to support.");
        setTyping(false);
        return;
      }
      if (!isAffirmativeReply(lower)) {
        addMessage("bot", "Reply **Confirm** to submit the ticket, or **Cancel** to discard it.");
        setTyping(false);
        return;
      }

      const supportMessage = convState.supportMessage || "";
      setConvState({ step: "idle" });
      try {
        if (user) {
          await addDoc(collection(db, "support_cases"), {
            userId: user.uid,
            userEmail: user.email || "",
            userName: user.name || "Valued User",
            subject: "Chatbot Support Query",
            message: supportMessage,
            status: "received",
            createdAt: serverTimestamp(),
          });
        }
        addMessage("bot", `Done! ✅ Your ticket has been filed with our team.`, {
          type: "support_success",
          title: "Support Ticket Raised",
          body: `Issue:\n"${supportMessage}"\n\nStatus: Pending\nWe'll review it soon!`,
        });
        addMessage("bot", `Anything else I can help with, ${firstName}? 😊`);
      } catch (err: any) {
        addMessage("bot", `Oops, couldn't file the ticket: ${err.message}. Try again?`);
      }
      setTyping(false);
      return;
    }

    // ── Context: awaiting category ─────────────────────────────────────────
    if (convState.step === "awaiting_category") {
      const { amount, note, date } = convState;
      let matchedCat: CategoryId | null = null;
      for (const [catId, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (keywords.some((k) => lower.includes(k))) { matchedCat = catId as CategoryId; break; }
      }
      if (!matchedCat) {
        const lm = CATEGORIES.find((c) => lower.includes(c.label.toLowerCase()));
        if (lm) matchedCat = lm.id;
      }
      if (!matchedCat) matchedCat = "other";

      const catLabel = CATEGORIES.find((c) => c.id === matchedCat)?.label || "Other";
      setConvState({ step: "awaiting_confirmation", amount, categoryId: matchedCat, note, date });
      addMessage("bot", `Got it — **${catLabel}** it is! 👍\n\n₹${amount} for "${note || "—"}" on **${date?.split("-").reverse().join("/")}** under **${catLabel}**. Shall I save this?`);
      setTyping(false);
      return;
    }

    // ── Context: awaiting confirmation ────────────────────────────────────
    if (convState.step === "awaiting_confirmation") {
      const { amount, categoryId, note, date } = convState;
      const catLabel = CATEGORIES.find((c) => c.id === categoryId)?.label || "Other";
      if (isAffirmativeReply(lower)) {
        setConvState({ step: "idle" });
        await executeAddExpense(amount!, categoryId!, note || "", date);
        return;
      }
      if (isNegativeReply(lower)) {
        setConvState({ step: "idle" });
        addMessage("bot", `Alright, I've discarded that! 🗑️ Let me know whenever you want to log something.`);
        setTyping(false);
        return;
      }
      addMessage("bot", `Just say **Yes** to save ₹${amount} under **${catLabel}**, or **No** to cancel. 😊`);
      setTyping(false);
      return;
    }

    // ── Context: awaiting bulk confirmation ───────────────────────────────
    if (convState.step === "awaiting_bulk_confirmation") {
      const { bulkExpenses } = convState;
      if (isAffirmativeReply(lower)) {
        setConvState({ step: "idle" });
        if (bulkExpenses && bulkExpenses.length > 0) {
          setTyping(true);
          try {
            const preparedItems = bulkExpenses.map(item => ({
              ...item,
              paymentMode: item.paymentMode || ("upi" as const),
            }));
            await addMultipleExpenses(preparedItems);
            safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            addMessage("bot", `Done! ✅ Successfully logged all **${bulkExpenses.length}** expenses! 💸`, {
              type: "expense_success",
              title: "Bulk Expenses Logged ✅",
              body: `Successfully imported ${bulkExpenses.length} transactions from bulk input.`,
            });
          } catch (err: any) {
            addMessage("bot", `Failed to save bulk expenses: ${err.message}`);
          } finally {
            setTyping(false);
          }
        }
        return;
      }
      if (isNegativeReply(lower)) {
        setConvState({ step: "idle" });
        addMessage("bot", `Cancelled! 🗑️ I've discarded all parsed transactions.`);
        setTyping(false);
        return;
      }
      addMessage("bot", `Just say **Yes** to log all **${bulkExpenses?.length || 0}** transactions, or **No** to cancel. 😊`);
      setTyping(false);
      return;
    }

    // ── Agent: bulk parsing execution ─────────────────────────────────────
    if (convState.step === "idle") {
      const rawLines = text.split(/[\n\.;\+]+/).map(l => l.trim()).filter(l => l.length > 0);
      const parsedItems: ParsedExpense[] = [];
      let lastActiveDate = todayISO();
      
      for (const line of rawLines) {
        const parsed = parseTransactionLine(line, lastActiveDate);
        if (parsed) {
          parsedItems.push(parsed);
          if (parsed.dateExplicitlyMatched) {
            lastActiveDate = parsed.date;
          }
        }
      }

      if (parsedItems.length > 1) {
        if (parsedItems.length > MAX_BULK_EXPENSES) {
          addMessage("bot", `I found ${parsedItems.length} transactions, but I can safely log up to ${MAX_BULK_EXPENSES} at a time. Please split this into smaller batches.`);
          setTyping(false);
          return;
        }

        const catLabel = (id: CategoryId) => CATEGORIES.find((c) => c.id === id)?.label || "Other";
        const formatDate = (iso: string) => {
          const parts = iso.split("-");
          return `${parts[2]}/${parts[1]}/${parts[0]}`;
        };
        
        let summaryText = `Wow, I detected **${parsedItems.length}** transactions in your message! 📊\n\n`;
        parsedItems.forEach((exp, idx) => {
          summaryText += `${idx + 1}. 📅 **${formatDate(exp.date)}** | 💸 **₹${exp.amount}** | 📝 *${exp.note}* (${catLabel(exp.categoryId)}) [${(exp.paymentMode || "upi").toUpperCase()}]\n`;
        });
        summaryText += `\nShall I log all **${parsedItems.length}** expenses for you?`;
        
        setConvState({ step: "awaiting_bulk_confirmation", bulkExpenses: parsedItems });
        addMessage("bot", summaryText);
        setTyping(false);
        return;
      }
    }

    // ── Agent: detect intents and run them all ─────────────────────────────
    const intents = detectIntents(lower);

    if (!intents.includes("expense")) {
      const groundedAnswer = buildExpenseInsightAnswer(text, expenses);
      if (groundedAnswer) {
        addMessage("bot", groundedAnswer);
        setTyping(false);
        return;
      }
    }

    if (intents.length === 0) {
      // Pure casual fallback
      const fallbacks = [
        `I'm not sure I caught that, ${firstName} 😅 Try telling me an expense like "spent 200 on lunch", or just say "help" to see what I can do!`,
        `Hmm, let me think... 🤔 I'm best at logging expenses, analysing budgets, and downloading statements. What did you need?`,
        `I'm still learning! 😄 Try things like "how much on food", "download statement", or just vent — I'm a good listener too 💙`,
      ];
      addMessage("bot", fallbacks[Math.floor(Math.random() * fallbacks.length)]);
      setTyping(false);
      return;
    }

    // Run each intent in sequence
    for (const intent of intents) {
      switch (intent) {

        case "abuse": {
          const replies = [
            `Hey ${firstName}, easy there! 😅 I know life gets frustrating — but I'm on your side. Take a breath and tell me what's really bothering you 💙`,
            `Haha, noted! 😄 I've been called worse by my training data, trust me. But seriously — what's up?`,
            `That energy! 😮 Look, I'm not going anywhere — I'm your buddy. Vent if you need to, just maybe minus the swear words? 😂 What's actually going on?`,
          ];
          addMessage("bot", replies[Math.floor(Math.random() * replies.length)]);
          break;
        }

        case "greeting": {
          const replies = [
            `Heyy ${firstName}! 😊 Great to see you! How's your day going?`,
            `Hi hi ${firstName}! 👋 What's up? Need to log something or just here to chat?`,
            `Namaste ${firstName}! 🙏 Always happy to help. What's on your mind?`,
          ];
          addMessage("bot", replies[Math.floor(Math.random() * replies.length)]);
          break;
        }

        case "how_are_you": {
          const replies = [
            `I'm doing great, ${firstName}! 😊 Just here keeping an eye on your finances (like a good friend should). How are YOU doing?`,
            `Living my best bot life! 🚀 Always happy to chat. How about you — good day?`,
            `Never been better! 😄 More importantly — how are YOU?`,
          ];
          addMessage("bot", replies[Math.floor(Math.random() * replies.length)]);
          break;
        }

        case "sad": {
          const replies = [
            `Hey, I hear you 💙 Bad days happen to everyone. I'm right here if you want to talk — sometimes just venting helps. What's going on?`,
            `Aww ${firstName} 🫂 I'm sorry you're feeling this way. You're not alone. Tell me what's bothering you?`,
            `That sounds tough 😔 Take your time — I'm not going anywhere. What's up?`,
          ];
          addMessage("bot", replies[Math.floor(Math.random() * replies.length)]);
          break;
        }

        case "happy": {
          const replies = [
            `That's the energy! 🔥 Keep it going, ${firstName}! What's making you feel good today?`,
            `Yessss! 🎉 Love that for you! What's the occasion?`,
          ];
          addMessage("bot", replies[Math.floor(Math.random() * replies.length)]);
          break;
        }

        case "joke": {
          const jokes = [
            `Why did the man put his money in the blender?\n\nBecause he wanted to make some *liquid assets*! 😂💸`,
            `I told my wallet I loved it.\nIt said: "Prove it — stop spending me!" 💔😂`,
            `A bank called me. They said my balance is outstanding.\n\nI said: "Thanks, I've always been exceptional!" 😄`,
            `What do you call someone who's great with money?\n\nMe, in theory. Reality is a different story 😅`,
          ];
          addMessage("bot", jokes[Math.floor(Math.random() * jokes.length)]);
          break;
        }

        case "thanks": {
          const replies = [
            `Aww, you're going to make me blush! 😊 Just doing my job — keeping you financially fit and emotionally supported 💙`,
            `Thank YOU for trusting me, ${firstName}! That means a lot. Now go save some money! 😄`,
          ];
          addMessage("bot", replies[Math.floor(Math.random() * replies.length)]);
          break;
        }

        case "motivate": {
          const replies = [
            `Here's a thought 💡\n\nEvery rupee you save today is future-you saying thank you. Small steps, big changes. You've got this! 💪`,
            `You know what's amazing about you? You're showing up — even on the hard days. That's half the battle won already 🌟`,
            `Don't be too hard on yourself, ${firstName} 🫂 Progress isn't always visible, but it's always happening when you keep trying.`,
          ];
          addMessage("bot", replies[Math.floor(Math.random() * replies.length)]);
          break;
        }

        case "security": {
          addMessage("bot", `Your expense data is stored under your signed-in Firebase account and protected by Firestore rules.\n\nFor SMS Auto-Sync, parsing happens on your device and I only work with the expense records available inside the app. I will not claim to see bank accounts, cards, or external transactions unless they are logged here.`);
          break;
        }

        case "sms": {
          addMessage("bot", `**SMS expense capture**\n\nWith your permission, WhisperLedger checks relevant bank and UPI SMS alerts on your device, extracts a possible amount and merchant, then asks for approval before anything is recorded. You can switch it off anytime from Profile.`);
          break;
        }

        case "profile_guide": {
          addMessage("bot", `Open the **Profile** tab to manage your account and preferences.\n\n• **Name and photo:** use the edit controls beside your profile.\n• **Appearance:** choose Dark, Light, or System under Theme Preference.\n• **SMS expense capture:** enable it to review detected bank/UPI SMS expenses before saving.\n• **Sign out:** available at the bottom of the screen.`);
          break;
        }

        case "ledger_guide": {
          addMessage("bot", `Need to modify or delete your transactions? I've got you! 📝\n\nGo to the **History** tab (or **Home** tab) and locate the transaction row:\n\n✏️ **Edit**: Tap the **Edit** button on the transaction to change the amount, category, date, or note.\n\n🗑️ **Delete**: Tap the red **Trash** icon to permanently remove that expense log.`);
          break;
        }

        case "edit_expense": {
          const editRequest = findExpenseEditRequest(text, expenses);
          if (editRequest === "ambiguous") {
            addMessage("bot", "I found more than one matching expense, so I will not guess. Include the old amount and a clear label, for example: **Change coffee from 120 to 150**.");
            break;
          }
          if (!editRequest) {
            addMessage("bot", "I can safely change the amount of one personal expense. Try: **Change coffee from 120 to 150**. Shared expenses must be edited from Household Space.");
            break;
          }

          const { expense, newAmount } = editRequest;
          const category = CATEGORIES.find((item) => item.id === expense.categoryId)?.label || "Other";
          setConvState({
            step: "awaiting_edit_review",
            editExpenseId: expense.id,
            editOriginalAmount: expense.amount,
            editNewAmount: newAmount,
          });
          addMessage(
            "bot",
            `I found **${expense.note || category}** on **${expense.date.split("-").reverse().join("/")}**.\n\nCurrent amount: **₹${expense.amount.toLocaleString("en-IN")}**\nNew amount: **₹${newAmount.toLocaleString("en-IN")}**\n\nFirst check: reply **Yes** to continue, or **Cancel** to keep it unchanged.`
          );
          break;
        }

        case "support": {
          setConvState({ step: "awaiting_support_desc" });
          addMessage("bot", `I can prepare a ticket for our support team. Please describe what happened, where it happened, and what you expected. I will show you the exact message for approval before sending it.`);
          break;
        }

        case "money_recovery": {
          const pending = getPendingReceivables();
          const totalPending = getTotalPendingAmount();

          if (pending.length === 0) {
            addMessage("bot", `💰 **Money Recovery Agent Status**\n\nYou currently have **no active pending refunds**! All your post-purchase money is settled.\n\nIf you have a new Amazon/Flipkart return, flight cancellation, or stuck UPI payment, open the **Money Recovery Hub** or paste the refund email right here!`);
          } else {
            const itemsText = pending.slice(0, 4).map(r => {
              const isOverdue = new Date().toISOString().split("T")[0] > r.expectedRefundDate;
              const statusPill = isOverdue ? "🔴 OVERDUE" : "🟢 EXPECTED";
              return `• **${r.merchant}**: ₹${r.amount.toLocaleString("en-IN")} (${statusPill} - Promised by ${r.expectedRefundDate})`;
            }).join("\n");

            addMessage("bot", `💰 **Money Recovery Agent**\n\nYou are currently waiting for **₹${totalPending.toLocaleString("en-IN")}** across **${pending.length} active case(s)**:\n\n${itemsText}\n\nGo to the **Money Recovery Hub** on your Home screen to view full evidence dossiers & generate customer support / NCH complaint templates!`);
          }
          break;
        }

        case "household_split": {
          if (!currentHousehold) {
            addMessage("bot", `You haven't joined a household yet, ${firstName}! 🏠\n\nCreate your flat or join using an invite code under **Profile ➔ Household & Flatmates**.`);
            break;
          }
          const splitDraft = parseTransactionLine(text);
          if (splitDraft && splitDraft.amount > 0) {
            addMessage(
              "bot",
              `I found a shared expense draft: **₹${splitDraft.amount.toLocaleString("en-IN")}** for **${splitDraft.note || "Shared expense"}**.\n\nTo protect everyone in ${currentHousehold.name}, I will not create or notify a split from chat. Open **Household Space → Add shared expense** to review members, amounts and payer before sending it.`
            );
          } else {
            addMessage("bot", `For a shared bill, use **Household Space → Add shared expense**. It lets you review the payer, members and each amount before anyone is notified.`);
          }
          break;
        }

        case "household_dues_query": {
          if (!currentHousehold) {
            addMessage("bot", `You don't have an active household yet, ${firstName}! You can create or join one from Profile.`);
            break;
          }
          const myUid = user?.uid || "";
          const debtsOwedToMe = pairwiseDebts.filter(d => d.toUid === myUid).map(d => ({ fromName: d.fromName, amount: d.amount }));
          const debtsIOwe = pairwiseDebts.filter(d => d.fromUid === myUid).map(d => ({ toName: d.toName, amount: d.amount }));
          const insight = buildHouseholdAndDuesInsightAnswer(
            currentHousehold.name,
            debtsOwedToMe,
            debtsIOwe,
            userNetBalance
          );
          addMessage("bot", insight);
          break;
        }

        case "household_settle": {
          if (!currentHousehold) {
            addMessage("bot", `You need to be in a household to settle flat dues, ${firstName}!`);
            break;
          }
          addMessage(
            "bot",
            `I can explain your household balances, but I will not record a settlement from a chat message. Open **Household Space** and use **Settle Up** to review the person, amount and note before saving.`
          );
          break;
        }

        case "help": {
          addMessage("bot", `Sure ${firstName}! Here's everything I can do for you 💡`, {
            type: "help_guide",
            title: "Assistant guide",
            body: `Log Expenses:\n  "Spent 150 on coffee"\n  "Log 500 for groceries"\n\nEdit an expense:\n  "Change coffee from 120 to 150"\n  I will show two clear checks before saving.\n\nAnalyse Spending:\n  "How much on food this month?"\n  "Where can I save money?"\n  "Show my recent expenses"\n\nApp Actions:\n  "Download my statement"\n  "Raise a support ticket"\n  "How do I enable SMS sync?"`,
          });
          break;
        }

        case "app_guide": {
          addMessage("bot", `I can be your one-stop app assistant.\n\n**Expenses:** tell me "spent 250 on lunch" or paste multiple lines. I will ask before saving.\n\n**Analytics:** ask "what did I spend this month", "top categories", "recent expenses", or "where can I save". I answer only from your logged expenses.\n\n**Statements:** ask "download PDF statement" for the current month.\n\n**SMS Sync:** go to Profile and enable Auto-Sync. New SMS expenses require approval before they become transactions.\n\n**Recovery:** ask about pending refunds or open the Money Recovery Hub.\n\n**Support:** say "raise support ticket" and describe the issue.`);
          break;
        }

        case "pdf": {
          const now = new Date();
          const year = now.getFullYear();
          const month = now.getMonth() + 1;
          const monthExpenses = expenses
            .filter((e) => {
              const [ey, em] = e.date.split("-").map(Number);
              return ey === year && em === month;
            })
            .map((e) => ({
              date: e.date,
              note: e.note,
              categoryId: e.categoryId,
              paymentMode: e.paymentMode,
              amount: e.amount,
            }));

          if (monthExpenses.length === 0) {
            addMessage("bot", `No expenses logged for this month yet, ${firstName} 🤔 Add some transactions first, then I'll generate a beautiful PDF for you!`);
          } else {
            addMessage("bot", `Generating your statement now... ⏳`);
            const { generateAndSharePDF } = await import("@/utils/pdfGenerator");
            const result = await generateAndSharePDF(
              year, month, monthExpenses,
              user ? { uid: user.uid, name: user.name, email: user.email } : null
            );
            if (result === "success") {
              addMessage("bot", "Your statement was saved to your device.");
            } else if (result === "cancelled") {
              addMessage("bot", "Statement download was cancelled. Ask me to download it again whenever you need it.");
            } else if (result === "unsupported") {
              addMessage("bot", "Direct PDF download is only available on Android in this build. You can still open statements from the Analytics tab on web.");
            } else {
              addMessage("bot", "Something went wrong generating the PDF. Try again or visit the Analytics tab.");
            }
          }
          break;
        }

        case "spend_query": {
          const now = new Date();
          const targetDate = extractDateFromText(text);
          
          // Detect category
          let foundCatId: CategoryId | null = null;
          for (const [catId, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
            if (keywords.some((k) => lower.includes(k))) { foundCatId = catId as CategoryId; break; }
          }
          if (!foundCatId) {
            const lm = CATEGORIES.find((c) => lower.includes(c.label.toLowerCase()));
            if (lm) foundCatId = lm.id;
          }

          const formatDate = (iso: string) => {
            const parts = iso.split("-");
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
          };

          if (targetDate) {
            // DAILY QUERY
            const dayExpenses = expenses.filter((e) => e.date === targetDate);
            const formattedDateText = formatDate(targetDate);

            if (foundCatId) {
              // Specific category on specific day
              const cat = CATEGORIES.find((c) => c.id === foundCatId)!;
              const catExpenses = dayExpenses.filter((e) => e.categoryId === foundCatId);
              const sum = catExpenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);

              if (sum > 0) {
                let msg = `You spent a total of **₹${sum.toLocaleString("en-IN")}** on **${cat.label}** on **${formattedDateText}** 📊\n\n`;
                catExpenses.forEach((e, idx) => {
                  msg += `• ₹${e.amount} for *${e.note || cat.label}*\n`;
                });
                addMessage("bot", msg);
              } else {
                addMessage("bot", `You haven't logged any expenses for **${cat.label}** on **${formattedDateText}**! 💸`);
              }
            } else {
              // Total spending on a specific day
              const sum = dayExpenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);
              
              if (sum > 0) {
                let msg = `Your total spending on **${formattedDateText}** was **₹${sum.toLocaleString("en-IN")}** across **${dayExpenses.length}** transactions: 💸\n\n`;
                dayExpenses.forEach((e, idx) => {
                  const catLabel = CATEGORIES.find((c) => c.id === e.categoryId)?.label || "Other";
                  msg += `${idx + 1}. **₹${e.amount}** — *${e.note || catLabel}* (${catLabel})\n`;
                });
                addMessage("bot", msg);
              } else {
                addMessage("bot", `You have no transactions logged for **${formattedDateText}**! 🌱`);
              }
            }
          } else {
            // MONTHLY QUERY (default to current month)
            const year = now.getFullYear();
            const month = now.getMonth() + 1;
            const monthExpenses = expenses.filter((e) => {
              const prefix = `${year}-${String(month).padStart(2, "0")}`;
              return e.date.startsWith(prefix);
            });

            if (foundCatId) {
              // Monthly category query
              const cat = CATEGORIES.find((c) => c.id === foundCatId)!;
              const catExpenses = monthExpenses.filter((e) => e.categoryId === foundCatId);
              const sum = catExpenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);
              const total = monthExpenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);
              const pct = total > 0 ? Math.round((sum / total) * 100) : 0;

              if (sum > 0) {
                let msg = `You've spent **₹${sum.toLocaleString("en-IN")}** on **${cat.label}** this month 📊\n`;
                msg += `That's **${pct}%** of your total monthly spend (₹${total.toLocaleString("en-IN")}).\n\nRecent logs:\n`;
                catExpenses.slice(0, 5).forEach((e) => {
                  msg += `• **₹${e.amount}** on ${formatDate(e.date)} — *${e.note || cat.label}*\n`;
                });
                addMessage("bot", msg);
              } else {
                addMessage("bot", `You haven't logged anything under **${cat.label}** this month yet! 🎉`);
              }
            } else {
              // General monthly spending query (falls back to analysis card!)
              const total = monthExpenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);
              const catTotals = getCategoryTotalsForMonth(year, month);
              const activeCats = Object.entries(catTotals)
                .filter(([_, v]) => v > 0)
                .sort((a, b) => b[1] - a[1]);

              if (total > 0) {
                const topEntry = activeCats[0];
                const topCat = CATEGORIES.find((c) => c.id === topEntry?.[0]);
                let msg = `Here's your spending snapshot this month 📊\n\n**Total:** ₹${total.toLocaleString("en-IN")}`;
                if (topCat) msg += `\n**Biggest:** ${topCat.label} (₹${topEntry[1].toLocaleString("en-IN")}, ${Math.round((topEntry[1] / total) * 100)}%)\n\nFull breakdown 👇`;
                addMessage("bot", msg, {
                  type: "budget_analysis",
                  title: "Monthly Budget Overview",
                  body: JSON.stringify(
                    activeCats.map(([catId, amount]) => {
                      const cat = CATEGORIES.find((c) => c.id === catId)!;
                      return { label: cat.label, amount, percentage: Math.round((amount / total) * 100), color: cat.color };
                    })
                  ),
                });
              } else {
                addMessage("bot", `You haven't logged any expenses this month yet! 🌱 Start by telling me what you've spent 😄`);
              }
            }
          }
          break;
        }

        case "expense": {
          const parsed = parseTransactionLine(text);
          if (!parsed) break;

          const { amount, categoryId, note, date } = parsed;

          if (categoryId === "other" && !note) {
            setConvState({ step: "awaiting_category", amount, note, date });
            addMessage("bot", `Got it — **₹${amount}** on **${date.split("-").reverse().join("/")}**! 👌\n\nWhich category should I file this under? (e.g. Food, Groceries, Travel, Shopping...)`);
          } else {
            await executeAddExpense(amount, categoryId, note, date);
          }
          break;
        }
      }
    }

    setTyping(false);
  }

  const executeAddExpense = async (amount: number, categoryId: CategoryId, note: string, customDate?: string) => {
    setTyping(true);
    try {
      const today = new Date();
      const isoDate = customDate || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const catLabel = CATEGORIES.find((c) => c.id === categoryId)?.label || "Other";
      await addExpense({
        amount,
        categoryId,
        note: note.trim() || catLabel,
        date: isoDate,
        paymentMode: "upi",
      });
      safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      addMessage("bot", `Done! ₹${amount} logged 💸`, {
        type: "expense_success",
        title: "Expense Logged ✅",
        body: `Amount: ₹${amount}\nCategory: ${catLabel}\nNote: ${note || catLabel}\nDate: ${isoDate}`,
        metadata: { categoryId, amount, note, date: isoDate },
      });
    } catch (err: any) {
      addMessage("bot", `Failed to save: ${err.message}`);
    } finally {
      setTyping(false);
    }
  };

  // ─── Suggestion chips ─────────────────────────────────────────────────────
  const getSuggestions = () => {
    if (convState.step === "awaiting_confirmation")
      return [{ text: "Yes, save it ✅", icon: "check" }, { text: "No, cancel ❌", icon: "x" }];
    if (convState.step === "awaiting_bulk_confirmation")
      return [{ text: "Yes, log all ✅", icon: "check" }, { text: "No, cancel ❌", icon: "x" }];
    if (convState.step === "awaiting_category")
      return [
        { text: "Food Outside", icon: "coffee" },
        { text: "Groceries", icon: "shopping-bag" },
        { text: "Travel", icon: "navigation" },
        { text: "Shopping", icon: "gift" },
        { text: "Other", icon: "hash" },
      ];
    return [
      { text: "Where can I save money?", icon: "trending-down" },
      { text: "Top spending categories", icon: "bar-chart-2" },
      { text: "Show recent expenses", icon: "list" },
      { text: "Complete app guide", icon: "compass" },
      { text: "📄 Download PDF Statement", icon: "download" },
      { text: "🆘 Raise Support Ticket", icon: "life-buoy" },
    ];
  };
  const suggestions = getSuggestions();

  // ─── Styles ───────────────────────────────────────────────────────────────
  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: topPad + 16,
      paddingHorizontal: 20,
      paddingBottom: 16,
      backgroundColor: colors.headerBg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    backBtn: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      ...iconSurface(colors),
    },
    avatar: {
      width: 38, height: 38, borderRadius: 12,
      alignItems: "center", justifyContent: "center",
      ...iconSurface(colors, "success"),
    },
    headerTitle: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold", color: colors.foreground },
    headerSub: { fontSize: 11, color: colors.success, fontFamily: "Inter_600SemiBold", marginTop: 2, flexDirection: "row", alignItems: "center", gap: 4 },
    listContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, flexGrow: 1 },
    bubbleWrap: { flexDirection: "row", marginBottom: 14, maxWidth: "82%" },
    userWrap: { alignSelf: "flex-end" },
    botWrap: { alignSelf: "flex-start" },
    bubble: {
      borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12,
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    },
    userBubble: { borderBottomRightRadius: 4, overflow: "hidden" },
    botBubble: {
      backgroundColor: colors.card, borderBottomLeftRadius: 4,
      borderWidth: 1, borderColor: colors.border,
    },
    userText: { color: "#fff", fontSize: 14, lineHeight: 21, fontFamily: "Inter_500Medium" },
    botText: { color: colors.foreground, fontSize: 14, lineHeight: 21, fontFamily: "Inter_400Regular" },
    timeText: { fontSize: 9, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 6, alignSelf: "flex-end" },
    typingWrap: {
      flexDirection: "row", alignItems: "center", alignSelf: "flex-start",
      backgroundColor: colors.card, borderRadius: 16,
      paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12, marginLeft: 16,
      borderWidth: 1, borderColor: colors.border, gap: 6,
    },
    typingText: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
    card: {
      padding: 12, marginTop: 10,
      width: SCREEN_WIDTH - 68,
      ...surfaceStyle(colors, false),
    },
    cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
    cardTitle: { fontSize: 13, fontWeight: "700", fontFamily: "Inter_700Bold", color: colors.foreground },
    cardBody: { fontSize: 12.5, lineHeight: 18, fontFamily: "Inter_500Medium", color: colors.mutedForeground },
    chipsScroll: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.background },
    chip: {
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
      backgroundColor: colors.card,
      borderWidth: 1, borderColor: colors.border,
      marginRight: 8, flexDirection: "row", alignItems: "center", gap: 6,
      shadowColor: colors.primary, shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06, shadowRadius: 3, elevation: 1,
    },
    chipText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    inputArea: {
      backgroundColor: colors.card,
      borderTopWidth: 1, borderTopColor: colors.border,
      paddingHorizontal: 14, paddingTop: 8,
      paddingBottom: Platform.OS === "ios" ? (insets.bottom > 0 ? insets.bottom : 10) : 10,
      flexDirection: "row", alignItems: "flex-end", gap: 8,
    },
    inputWrap: {
      flex: 1, minHeight: 46, maxHeight: 120, backgroundColor: colors.muted,
      borderRadius: 20, paddingHorizontal: 16, paddingVertical: Platform.OS === "ios" ? 8 : 4,
      flexDirection: "row", alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    input: { flex: 1, color: colors.foreground, fontFamily: "Inter_400Regular", fontSize: 14 },
    voiceStatusBar: {
      backgroundColor: colors.card,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingHorizontal: 18,
      paddingVertical: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    voiceStatusText: {
      flex: 1,
      color: colors.mutedForeground,
      fontSize: 12,
      fontFamily: "Inter_500Medium",
    },
    micBtn: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.muted,
    },
    sendBtn: {
      width: 46, height: 46, borderRadius: 23,
      backgroundColor: colors.primary, alignItems: "center", justifyContent: "center",
      shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
    },
  });

  // ─── JSX ──────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          activeOpacity={0.8}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="chevron-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.avatar}>
          <Feather name="message-circle" size={20} color="#10b981" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>WhisperBot</Text>
          <Text style={styles.headerSub}>Private, review-first assistance</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.select({ ios: insets.bottom + 49, default: 0 })}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => {
            const isUser = item.sender === "user";
            return (
              <View style={[styles.bubbleWrap, isUser ? styles.userWrap : styles.botWrap]}>
                {isUser ? (
                  <LinearGradient
                    colors={gradients.primary}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.bubble, styles.userBubble]}
                  >
                    {renderMarkdown(item.text, styles.userText, "#fff")}
                    <Text style={[styles.timeText, { color: "rgba(255,255,255,0.72)" }]}>
                      {item.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </LinearGradient>
                ) : (
                  <View style={[styles.bubble, styles.botBubble]}>
                    {renderMarkdown(item.text, styles.botText, colors.primary)}
                    {item.customCard && (
                      <View style={styles.card}>
                        <View style={styles.cardTitleRow}>
                          <Feather
                            name={
                              item.customCard.type === "expense_success" ? "check-circle" :
                              item.customCard.type === "budget_analysis" ? "bar-chart-2" :
                              item.customCard.type === "support_success" ? "mail" : "help-circle"
                            }
                            size={16} color={colors.primary}
                          />
                          <Text style={styles.cardTitle}>{item.customCard.title}</Text>
                        </View>
                        {item.customCard.type === "budget_analysis" ? (
                          <View style={{ gap: 8, marginTop: 4 }}>
                            {JSON.parse(item.customCard.body).map((d: any, i: number) => (
                              <View key={i} style={{ gap: 4 }}>
                                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                                  <Text style={{ fontSize: 11.5, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>{d.label}</Text>
                                  <Text style={{ fontSize: 11.5, fontFamily: "Inter_700Bold", color: colors.mutedForeground }}>₹{d.amount.toLocaleString("en-IN")} ({d.percentage}%)</Text>
                                </View>
                                <View style={{ height: 6, backgroundColor: colors.muted, borderRadius: 3, overflow: "hidden" }}>
                                  <View style={{ height: "100%", width: `${d.percentage}%`, backgroundColor: d.color }} />
                                </View>
                              </View>
                            ))}
                          </View>
                        ) : (
                          <Text style={styles.cardBody}>{item.customCard.body}</Text>
                        )}
                      </View>
                    )}
                    <Text style={styles.timeText}>
                      {item.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </View>
                )}
              </View>
            );
          }}
        />

        {typing && (
          <View style={styles.typingWrap}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.typingText}>WhisperBot is typing...</Text>
          </View>
        )}

        {/* Suggestion Chips */}
        <View style={{ height: 54, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
          <FlatList
            horizontal
            data={suggestions}
            keyExtractor={(item) => item.text}
            contentContainerStyle={styles.chipsScroll}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.chip}
                activeOpacity={0.7}
                onPress={() => {
                  if (convState.step === "awaiting_confirmation" || convState.step === "awaiting_category" || convState.step === "awaiting_bulk_confirmation") {
                    setInputText("");
                    addMessage("user", item.text);
                    setTyping(true);
                    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setTimeout(() => processUserMessage(item.text), 800);
                  } else {
                    setInputText(item.text);
                    setTimeout(() => inputRef.current?.focus(), 80);
                  }
                }}
              >
                <Feather name={item.icon as any} size={13} color={colors.primary} />
                <Text style={styles.chipText}>{item.text}</Text>
              </TouchableOpacity>
            )}
          />
        </View>

        {!!voiceStatus && (
          <View style={styles.voiceStatusBar}>
            <Feather name={isListening ? "radio" : "mic"} size={13} color={isListening ? "#ef4444" : colors.primary} />
            <Text style={styles.voiceStatusText} numberOfLines={1}>{voiceStatus}</Text>
          </View>
        )}

        {/* Input Bar */}
        <View style={styles.inputArea}>
          <TouchableOpacity
            style={[
              styles.micBtn,
              isListening && {
                backgroundColor: "rgba(239, 68, 68, 0.12)",
                borderColor: "rgba(239, 68, 68, 0.5)",
              },
            ]}
            activeOpacity={0.8}
            onPress={handleVoiceCommand}
          >
            <Feather name={isListening ? "square" : "mic"} size={18} color={isListening ? "#ef4444" : colors.primary} />
          </TouchableOpacity>
          <View style={styles.inputWrap}>
            <TextInput
              ref={inputRef}
              style={[styles.input, { paddingVertical: Platform.OS === "ios" ? 4 : 0 }]}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ask about your expenses or the app"
              placeholderTextColor={colors.mutedForeground}
              maxLength={MAX_CHAT_INPUT_LENGTH}
              multiline={true}
              blurOnSubmit={false}
            />
          </View>
          <TouchableOpacity
            style={[styles.sendBtn, !inputText.trim() && { opacity: 0.5 }]}
            activeOpacity={0.8}
            disabled={!inputText.trim()}
            onPress={handleSend}
          >
            <Feather name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
