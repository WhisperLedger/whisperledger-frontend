import AsyncStorage from "@react-native-async-storage/async-storage";
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  addDoc,
  setDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  orderBy,
  Timestamp,
} from "firebase/firestore";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { queueSMSApprovalNotifications, registerSMSBackgroundSync } from "@/utils/smsSync";
import { markSMSApprovalProcessed, dismissAndClearNotification } from "@/utils/notifications";

import { db } from "../lib/firebase";
import { api } from "../lib/api";
import { runtimeConfig } from "@/config/runtime";
import { useAuth } from "./AuthContext";

export type PaymentMode = "none" | "cash" | "upi" | "card" | "netbanking";

export type CategoryId =
  | "travel"
  | "groceries"
  | "rent"
  | "maid_cook"
  | "food_outside"
  | "transfer"
  | "utilities"
  | "shopping"
  | "health"
  | "entertainment"
  | "invest"
  | "education"
  | "bills"
  | "subscriptions"
  | "personal_care"
  | "gifts"
  | "family"
  | "fuel"
  | "pets"
  | "other";

export interface Category {
  id: CategoryId;
  label: string;
  icon: string;
  color: string;
  lightColor: string;
}

export const CATEGORIES: Category[] = [
  { id: "travel", label: "Travel", icon: "navigation", color: "#0EA5E9", lightColor: "#E0F2FE" },
  { id: "groceries", label: "Groceries", icon: "shopping-bag", color: "#10b981", lightColor: "#d1fae5" },
  { id: "rent", label: "Rent", icon: "home", color: "#7C2D12", lightColor: "#FFEDD5" },
  { id: "maid_cook", label: "Maid & Cook", icon: "user-check", color: "#8B5CF6", lightColor: "#EDE9FE" },
  { id: "food_outside", label: "Food Outside", icon: "coffee", color: "#f59e0b", lightColor: "#fef3c7" },
  { id: "transfer", label: "Transfer", icon: "send", color: "#BE123C", lightColor: "#FFE4E6" },
  { id: "utilities", label: "Utilities", icon: "zap", color: "#0891B2", lightColor: "#CFFAFE" },
  { id: "shopping", label: "Shopping", icon: "tag", color: "#f97316", lightColor: "#ffedd5" },
  { id: "health", label: "Health", icon: "heart", color: "#ef4444", lightColor: "#fee2e2" },
  { id: "entertainment", label: "Entertainment", icon: "film", color: "#C2410C", lightColor: "#FFEDD5" },
  { id: "invest", label: "Investment", icon: "trending-up", color: "#15803D", lightColor: "#DCFCE7" },
  { id: "education", label: "Education", icon: "book-open", color: "#4338CA", lightColor: "#E0E7FF" },
  { id: "bills", label: "Bills", icon: "file-text", color: "#0f766e", lightColor: "#ccfbf1" },
  { id: "subscriptions", label: "Subscriptions", icon: "repeat", color: "#475569", lightColor: "#E2E8F0" },
  { id: "personal_care", label: "Personal Care", icon: "scissors", color: "#db2777", lightColor: "#fce7f3" },
  { id: "gifts", label: "Gifts", icon: "gift", color: "#ea580c", lightColor: "#ffedd5" },
  { id: "family", label: "Family", icon: "users", color: "#0369A1", lightColor: "#E0F2FE" },
  { id: "fuel", label: "Fuel", icon: "truck", color: "#334155", lightColor: "#E2E8F0" },
  { id: "pets", label: "Pets", icon: "smile", color: "#65A30D", lightColor: "#ECFCCB" },
  { id: "other", label: "Other", icon: "more-horizontal", color: "#64748b", lightColor: "#F1F5F9" },
];

export interface Expense {
  id: string;
  amount: number;
  categoryId: CategoryId;
  paymentMode?: PaymentMode;
  note: string;
  merchant?: string;
  location?: string;
  date: string; // ISO date string YYYY-MM-DD
  createdAt: number;
  smsId?: string;
  householdExpenseId?: string;
  householdId?: string;
  isHouseholdSplitShare?: boolean;
  householdCreatedBy?: string;
  householdPayerUid?: string;
  householdPayerName?: string;
}

interface ExpenseContextType {
  expenses: Expense[];
  addExpense: (expense: Omit<Expense, "id" | "createdAt">) => Promise<void>;
  addMultipleExpenses: (newItems: Omit<Expense, "id" | "createdAt">[]) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  updateExpense: (id: string, updates: Partial<Omit<Expense, "id" | "createdAt">>) => Promise<void>;
  getExpensesForDate: (date: string) => Expense[];
  getExpensesForMonth: (year: number, month: number) => Expense[];
  getTotalForDate: (date: string) => number;
  getTotalForMonth: (year: number, month: number) => number;
  getCategoryTotalsForMonth: (year: number, month: number) => Record<CategoryId, number>;
  isLoading: boolean;
}

const ExpenseContext = createContext<ExpenseContextType | null>(null);

export function ExpenseProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthReady } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthReady) {
      setIsLoading(true);
      return;
    }

    if (!user) {
      setExpenses([]);
      setIsLoading(false);
      return;
    }

    if (runtimeConfig.dataBackend === "api") {
      api.listExpenses({ limit: 500 })
        .then(async (res) => {
          if (res.success && Array.isArray(res.data)) {
            const loaded: Expense[] = res.data.map((item: any) => ({
              id: item.id,
              amount: Number(item.amount),
              categoryId: (item.category || "other") as CategoryId,
              merchant: item.merchant,
              note: item.note || item.merchant || "Expense",
              paymentMode: (item.payment_method?.toLowerCase() || "upi") as PaymentMode,
              date: item.date ? item.date.split("T")[0] : new Date().toISOString().split("T")[0],
              createdAt: item.created_at ? new Date(item.created_at).getTime() : Date.now(),
              householdId: item.household_id || undefined,
              isHouseholdSplitShare: item.is_shared || false,
            }));
            setExpenses(loaded);
            await AsyncStorage.setItem(`@expenses_${user.uid}`, JSON.stringify(loaded)).catch(() => null);
          } else {
            const cached = await AsyncStorage.getItem(`@expenses_${user.uid}`);
            if (cached) setExpenses(JSON.parse(cached));
          }
        })
        .catch(async (e) => {
          console.warn("⚠️ API listExpenses error, using local cache:", e);
          const cached = await AsyncStorage.getItem(`@expenses_${user.uid}`);
          if (cached) setExpenses(JSON.parse(cached));
        })
        .finally(() => {
          setIsLoading(false);
        });
      return;
    }

    const q = query(
      collection(db, `users/${user.uid}/expenses`),
      orderBy("createdAt", "desc")
    );

    const normalizeDateStr = (dateStr: any) => {
      if (!dateStr || typeof dateStr !== "string" || !dateStr.includes("-")) return dateStr;
      const parts = dateStr.split("-");
      if (parts.length !== 3) return dateStr;
      return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
    };

    const unsubscribe = onSnapshot(q, {
      next: (snapshot) => {
        const loadedExpenses: Expense[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data() as any;
          loadedExpenses.push({
            id: doc.id,
            ...data,
            date: normalizeDateStr(data.date || ""),
          } as Expense);
        });
        setExpenses(loadedExpenses);
        AsyncStorage.setItem(`@expenses_${user.uid}`, JSON.stringify(loadedExpenses)).catch(() => null);
        setIsLoading(false);

        // SMS Auto-Sync Check with full existing expenses
        checkSMS(loadedExpenses);
      },
      error: async (err) => {
        console.warn("⚠️ Firestore snapshot listener failed (likely permission-denied/offline). Falling back to local cache.", err);
        try {
          const cached = await AsyncStorage.getItem(`@expenses_${user.uid}`);
          if (cached) {
            const parsed = JSON.parse(cached) as Expense[];
            const sanitized = parsed.map((e) => ({
              ...e,
              date: normalizeDateStr(e.date || ""),
            }));
            setExpenses(sanitized);
            checkSMS(sanitized);
          }
        } catch (storageErr) {
          console.error("Local storage read failed:", storageErr);
        }
        setIsLoading(false);
      }
    });

    // SMS Auto-Sync Check (guarded to run once per mount/session)
    let smsCheckDone = false;
    const checkSMS = async (existingList?: Expense[]) => {
      if (smsCheckDone) return;
      const autoSyncEnabled = await AsyncStorage.getItem("@auto_sync_enabled");
      if (autoSyncEnabled === "true") {
        smsCheckDone = true;
        try {
          await queueSMSApprovalNotifications({ userId: user.uid, existingExpenses: existingList || [] });
          await registerSMSBackgroundSync();
        } catch (e) {
          console.log("Auto sync check failed", e);
        }
      }
    };

    return unsubscribe;
  }, [user, isAuthReady]);

  const addExpense = useCallback(async (expense: Omit<Expense, "id" | "createdAt">) => {
    if (!user) return;

    if (runtimeConfig.dataBackend === "api") {
      const tempId = "temp_" + Date.now();
      const newExpense: Expense = { id: tempId, ...expense, createdAt: Date.now() };
      setExpenses((prev) => [newExpense, ...prev]);

      try {
        const cached = await AsyncStorage.getItem(`@expenses_${user.uid}`);
        const list = cached ? JSON.parse(cached) : [];
        await AsyncStorage.setItem(`@expenses_${user.uid}`, JSON.stringify([newExpense, ...list]));

        if (newExpense.smsId) {
          await markSMSApprovalProcessed(newExpense.smsId);
          await dismissAndClearNotification(newExpense.smsId, user.uid);
        }

        const res = await api.createExpense({
          amount: expense.amount,
          category: expense.categoryId,
          merchant: expense.merchant || expense.note || "Expense",
          outflow_type: expense.householdId ? "shared_household" : "true_personal",
          payment_method: expense.paymentMode || "UPI",
          note: expense.note,
          date: expense.date ? new Date(expense.date).toISOString() : new Date().toISOString(),
          household_id: expense.householdId,
        });

        if (res.success && res.data?.id) {
          setExpenses((prev) => prev.map((e) => (e.id === tempId ? { ...e, id: res.data!.id } : e)));
        }
      } catch (err) {
        console.error("API createExpense error:", err);
      }
      return;
    }

    const docRef = doc(collection(db, `users/${user.uid}/expenses`));
    const docId = docRef.id;
    const newExpense: Expense = { id: docId, ...expense, createdAt: Date.now() };
    
    // Optimistic UI Update
    setExpenses((prev) => [newExpense, ...prev]);
    
    try {
      const cached = await AsyncStorage.getItem(`@expenses_${user.uid}`);
      const list = cached ? JSON.parse(cached) : [];
      await AsyncStorage.setItem(`@expenses_${user.uid}`, JSON.stringify([newExpense, ...list]));

      if (newExpense.smsId) {
        await markSMSApprovalProcessed(newExpense.smsId);
        await dismissAndClearNotification(newExpense.smsId, user.uid);
      }
    } catch (err) {
      console.error("Local storage save failed:", err);
    }

    // A confirmed add must persist remotely. Roll back optimistic state if it
    // cannot be written, rather than showing a record that only exists locally.
    try {
      const { id, ...firebaseData } = newExpense;
      await setDoc(docRef, firebaseData);
    } catch (e) {
      setExpenses((prev) => prev.filter((item) => item.id !== docId));
      try {
        const cached = await AsyncStorage.getItem(`@expenses_${user.uid}`);
        if (cached) {
          const list = JSON.parse(cached) as Expense[];
          await AsyncStorage.setItem(`@expenses_${user.uid}`, JSON.stringify(list.filter((item) => item.id !== docId)));
        }
      } catch {
        // The remote write error is the actionable failure.
      }
      throw e;
    }
  }, [user]);

  const addMultipleExpenses = useCallback(async (newItems: Omit<Expense, "id" | "createdAt">[]) => {
    if (!user || newItems.length === 0) return;
    const timestamp = Date.now();
    const preparedItems = newItems.map((item, idx) => {
      const docRef = doc(collection(db, `users/${user.uid}/expenses`));
      return {
        id: docRef.id,
        ...item,
        createdAt: timestamp + idx,
      };
    });

    // Optimistic UI Update
    setExpenses((prev) => [...preparedItems, ...prev]);

    try {
      const cached = await AsyncStorage.getItem(`@expenses_${user.uid}`);
      const list = cached ? JSON.parse(cached) : [];
      await AsyncStorage.setItem(`@expenses_${user.uid}`, JSON.stringify([...preparedItems, ...list]));

      for (const item of preparedItems) {
        if (item.smsId) {
          await markSMSApprovalProcessed(item.smsId);
          await dismissAndClearNotification(item.smsId, user.uid);
        }
      }
    } catch (err) {
      console.error("Local storage batch save failed:", err);
    }

    // Keep a batch all-or-nothing from the user's point of view. If the remote
    // write fails, remove the optimistic additions and report the failure.
    try {
      const batchPromises = preparedItems.map(item => {
        const { id, ...firebaseData } = item;
        return setDoc(doc(db, `users/${user.uid}/expenses`, id), firebaseData);
      });
      await Promise.all(batchPromises);
    } catch (e) {
      const newIds = new Set(preparedItems.map((item) => item.id));
      setExpenses((prev) => prev.filter((item) => !newIds.has(item.id)));
      try {
        const cached = await AsyncStorage.getItem(`@expenses_${user.uid}`);
        if (cached) {
          const list = JSON.parse(cached) as Expense[];
          await AsyncStorage.setItem(`@expenses_${user.uid}`, JSON.stringify(list.filter((item) => !newIds.has(item.id))));
        }
      } catch {
        // The remote write error is the actionable failure.
      }
      throw e;
    }
  }, [user]);

  const deleteExpense = useCallback(async (id: string) => {
    if (!user) return;
    const previousExpense = expenses.find((expense) => expense.id === id);
    if (!previousExpense) throw new Error("Expense not found");
    
    // Optimistic UI Update
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    
    if (runtimeConfig.dataBackend === "api") {
      try {
        const cached = await AsyncStorage.getItem(`@expenses_${user.uid}`);
        if (cached) {
          const list = JSON.parse(cached) as Expense[];
          await AsyncStorage.setItem(`@expenses_${user.uid}`, JSON.stringify(list.filter(e => e.id !== id)));
        }
        await api.request(`/expenses/${id}`, { method: "DELETE" });
      } catch (e) {
        console.error("API delete expense error:", e);
      }
      return;
    }

    try {
      const expToDelete = expenses.find(e => e.id === id);
      if (expToDelete?.smsId) {
        const deletedStr = await AsyncStorage.getItem("@deleted_sms_ids");
        const deletedIds = deletedStr ? JSON.parse(deletedStr) : [];
        if (!deletedIds.includes(expToDelete.smsId)) {
          deletedIds.push(expToDelete.smsId);
          await AsyncStorage.setItem("@deleted_sms_ids", JSON.stringify(deletedIds));
        }
      }
      
      const cached = await AsyncStorage.getItem(`@expenses_${user.uid}`);
      if (cached) {
        const list = JSON.parse(cached) as Expense[];
        await AsyncStorage.setItem(`@expenses_${user.uid}`, JSON.stringify(list.filter(e => e.id !== id)));
      }
    } catch (e) {
      console.error("Local storage deletion/blacklist failed:", e);
    }

    // A delete is irreversible from the UI. Restore the entry if the remote
    // delete is rejected or the device is offline.
    try {
      await deleteDoc(doc(db, `users/${user.uid}/expenses`, id));
    } catch (e) {
      setExpenses((prev) => [previousExpense, ...prev]);
      try {
        const cached = await AsyncStorage.getItem(`@expenses_${user.uid}`);
        if (cached) {
          const list = JSON.parse(cached) as Expense[];
          if (!list.some((expense) => expense.id === id)) {
            await AsyncStorage.setItem(`@expenses_${user.uid}`, JSON.stringify([previousExpense, ...list]));
          }
        }
      } catch {
        // The remote write error is the actionable failure.
      }
      throw e;
    }
  }, [user, expenses]);

  const updateExpense = useCallback(async (id: string, updates: Partial<Omit<Expense, "id" | "createdAt">>) => {
    if (!user) return;
    const previousExpense = expenses.find((expense) => expense.id === id);
    if (!previousExpense) throw new Error("Expense not found");
    
    // Optimistic UI Update
    setExpenses((prev) => prev.map((e) => e.id === id ? { ...e, ...updates } : e));

    if (runtimeConfig.dataBackend === "api") {
      try {
        const cached = await AsyncStorage.getItem(`@expenses_${user.uid}`);
        if (cached) {
          const list = JSON.parse(cached) as Expense[];
          const updatedList = list.map(e => e.id === id ? { ...e, ...updates } : e);
          await AsyncStorage.setItem(`@expenses_${user.uid}`, JSON.stringify(updatedList));
        }
      } catch (e) {
        console.error("Local storage update failed:", e);
      }
      return;
    }
    
    try {
      const cached = await AsyncStorage.getItem(`@expenses_${user.uid}`);
      if (cached) {
        const list = JSON.parse(cached) as Expense[];
        const updatedList = list.map(e => e.id === id ? { ...e, ...updates } : e);
        await AsyncStorage.setItem(`@expenses_${user.uid}`, JSON.stringify(updatedList));
      }
    } catch (e) {
      console.error("Local storage update failed:", e);
    }

    // A confirmed edit must persist remotely. If that fails, roll the local
    // optimistic update back and let the caller show an honest failure state.
    try {
      await updateDoc(doc(db, `users/${user.uid}/expenses`, id), updates);
    } catch (e) {
      setExpenses((prev) => prev.map((expense) => expense.id === id ? previousExpense : expense));
      try {
        const cached = await AsyncStorage.getItem(`@expenses_${user.uid}`);
        if (cached) {
          const list = JSON.parse(cached) as Expense[];
          await AsyncStorage.setItem(
            `@expenses_${user.uid}`,
            JSON.stringify(list.map((expense) => expense.id === id ? previousExpense : expense))
          );
        }
      } catch {
        // The Firestore error is the actionable failure; cache recovery can retry later.
      }
      throw e;
    }
  }, [user, expenses]);

  const getExpensesForDate = useCallback((date: string) => {
    return expenses.filter((e) => e.date === date);
  }, [expenses]);

  const getExpensesForMonth = useCallback((year: number, month: number) => {
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    return expenses.filter((e) => e.date.startsWith(prefix));
  }, [expenses]);

  const getTotalForDate = useCallback((date: string) => {
    return expenses.filter((e) => e.date === date).reduce((sum, e) => sum + Number(e.amount || 0), 0);
  }, [expenses]);

  const getTotalForMonth = useCallback((year: number, month: number) => {
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    return expenses.filter((e) => e.date.startsWith(prefix)).reduce((sum, e) => sum + Number(e.amount || 0), 0);
  }, [expenses]);

  const getCategoryTotalsForMonth = useCallback((year: number, month: number): Record<CategoryId, number> => {
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    const result = {} as Record<CategoryId, number>;
    CATEGORIES.forEach((c) => { result[c.id] = 0; });
    expenses.filter((e) => e.date.startsWith(prefix)).forEach((e) => {
      const catId = CATEGORIES.some((c) => c.id === e.categoryId) ? e.categoryId : "other";
      result[catId] = (result[catId] || 0) + Number(e.amount || 0);
    });
    return result;
  }, [expenses]);

  return (
    <ExpenseContext.Provider
      value={{
        expenses,
        addExpense,
        addMultipleExpenses,
        deleteExpense,
        updateExpense,
        getExpensesForDate,
        getExpensesForMonth,
        getTotalForDate,
        getTotalForMonth,
        getCategoryTotalsForMonth,
        isLoading,
      }}
    >
      {children}
    </ExpenseContext.Provider>
  );
}

export function useExpenses() {
  const ctx = useContext(ExpenseContext);
  if (!ctx) throw new Error("useExpenses must be used within ExpenseProvider");
  return ctx;
}
