import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  collection,
  onSnapshot,
  query,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  orderBy,
} from "firebase/firestore";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { useAuth } from "./AuthContext";
import { db } from "@/lib/firebase";
import type { Receivable, ReceivableStatus, ReceivableHistoryLog } from "@/types/receivable";
import { isCreditOrReversalSMS } from "@/utils/receivablesParser";

interface ReceivablesContextType {
  receivables: Receivable[];
  isLoading: boolean;
  addReceivable: (item: Omit<Receivable, "id" | "userId" | "createdAt" | "updatedAt" | "history" | "evidence">, evidenceTitle?: string) => Promise<void>;
  updateReceivableStatus: (id: string, newStatus: ReceivableStatus, note: string) => Promise<void>;
  addInteractionLog: (id: string, note: string, newExpectedDate?: string) => Promise<void>;
  markAsRecovered: (id: string, note?: string) => Promise<void>;
  deleteReceivable: (id: string) => Promise<void>;
  getPendingReceivables: () => Receivable[];
  getTotalPendingAmount: () => number;
  getTotalRecoveredAmount: () => number;
  reconcileCreditSMS: (smsMerchant: string, amount: number, smsId?: string) => Promise<boolean>;
}

const ReceivablesContext = createContext<ReceivablesContextType | null>(null);

export function ReceivablesProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthReady } = useAuth();
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthReady) {
      setIsLoading(true);
      return;
    }

    if (!user) {
      setReceivables([]);
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, `users/${user.uid}/receivables`),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, {
      next: async (snapshot) => {
        const loaded: Receivable[] = [];
        let deletedIds: string[] = [];
        try {
          const deletedStr = await AsyncStorage.getItem(`@deleted_receivables_${user.uid}`);
          if (deletedStr) deletedIds = JSON.parse(deletedStr);
        } catch (e) {
          console.warn("Failed to read deleted receivables list:", e);
        }

        snapshot.forEach((docSnap) => {
          if (!deletedIds.includes(docSnap.id)) {
            const data = docSnap.data() as any;
            loaded.push({
              id: docSnap.id,
              ...data,
            } as Receivable);
          }
        });
        setReceivables(loaded);
        AsyncStorage.setItem(`@receivables_${user.uid}`, JSON.stringify(loaded)).catch(() => null);
        setIsLoading(false);
      },
      error: async (err) => {
        console.warn("⚠️ Firestore snapshot listener for receivables failed. Falling back to cache.", err);
        try {
          const cached = await AsyncStorage.getItem(`@receivables_${user.uid}`);
          if (cached) {
            setReceivables(JSON.parse(cached));
          }
        } catch (e) {
          console.error("Local storage read failed:", e);
        }
        setIsLoading(false);
      },
    });

    return unsubscribe;
  }, [user, isAuthReady]);

  const addReceivable = useCallback(
    async (
      item: Omit<Receivable, "id" | "userId" | "createdAt" | "updatedAt" | "history" | "evidence">,
      evidenceTitle?: string
    ) => {
      if (!user) return;
      const now = Date.now();
      const localId = Math.random().toString(36).substring(2, 9);
      const initialHistory: ReceivableHistoryLog[] = [
        {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: now,
          status: item.status,
          note: item.notes || "Case created automatically from ingestion.",
          actor: "system",
        },
      ];

      const newReceivable: Receivable = {
        id: localId,
        userId: user.uid,
        ...item,
        history: initialHistory,
        evidence: evidenceTitle
          ? [
              {
                id: Math.random().toString(36).substring(2, 9),
                type: "order_confirmation",
                title: evidenceTitle,
                timestamp: now,
              },
            ]
          : [],
        createdAt: now,
        updatedAt: now,
      };

      setReceivables((prev) => [newReceivable, ...prev]);

      try {
        const cached = await AsyncStorage.getItem(`@receivables_${user.uid}`);
        const list = cached ? JSON.parse(cached) : [];
        await AsyncStorage.setItem(`@receivables_${user.uid}`, JSON.stringify([newReceivable, ...list]));
      } catch (e) {
        console.error("Local storage save failed:", e);
      }

      try {
        const { id, ...dataToSave } = newReceivable;
        const docRef = await addDoc(collection(db, `users/${user.uid}/receivables`), dataToSave);
        // Replace temp localId with real Firestore docRef.id
        setReceivables((prev) =>
          prev.map((r) => (r.id === localId ? { ...r, id: docRef.id } : r))
        );
      } catch (e) {
        console.warn("⚠️ Background Firestore sync failed:", e);
      }
    },
    [user]
  );

  const updateReceivableStatus = useCallback(
    async (id: string, newStatus: ReceivableStatus, note: string) => {
      if (!user) return;
      const now = Date.now();
      const newLog: ReceivableHistoryLog = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: now,
        status: newStatus,
        note,
        actor: "user",
      };

      setReceivables((prev) =>
        prev.map((r) => {
          if (r.id !== id) return r;
          const updatedHistory = [newLog, ...(r.history || [])];
          return {
            ...r,
            status: newStatus,
            history: updatedHistory,
            updatedAt: now,
          };
        })
      );

      try {
        const rec = receivables.find((r) => r.id === id);
        if (rec) {
          const updatedHistory = [newLog, ...(rec.history || [])];
          await updateDoc(doc(db, `users/${user.uid}/receivables`, id), {
            status: newStatus,
            history: updatedHistory,
            updatedAt: now,
          });
        }
      } catch (e) {
        console.warn("⚠️ Background update failed:", e);
      }
    },
    [user, receivables]
  );

  const addInteractionLog = useCallback(
    async (id: string, note: string, newExpectedDate?: string) => {
      if (!user) return;
      const now = Date.now();
      const target = receivables.find((r) => r.id === id);
      if (!target) return;

      const newLog: ReceivableHistoryLog = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: now,
        status: "SUPPORT_CONTACTED",
        note,
        actor: "merchant_support",
        newExpectedDate,
      };

      const updatedHistory = [newLog, ...(target.history || [])];
      const updates: Partial<Receivable> = {
        status: "SUPPORT_CONTACTED",
        history: updatedHistory,
        lastSupportContactDate: new Date().toISOString().split("T")[0],
        updatedAt: now,
      };
      if (newExpectedDate) {
        updates.expectedRefundDate = newExpectedDate;
      }

      setReceivables((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));

      try {
        await updateDoc(doc(db, `users/${user.uid}/receivables`, id), updates);
      } catch (e) {
        console.warn("⚠️ Interaction log Firestore sync failed:", e);
      }
    },
    [user, receivables]
  );

  const markAsRecovered = useCallback(
    async (id: string, note?: string) => {
      if (!user) return;
      const now = Date.now();
      const target = receivables.find((r) => r.id === id);
      if (!target) return;

      const today = new Date().toISOString().split("T")[0];
      const initiated = new Date(target.dateInitiated);
      const diffDays = Math.max(0, Math.floor((now - initiated.getTime()) / (1000 * 60 * 60 * 24)));

      const newLog: ReceivableHistoryLog = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: now,
        status: "RECOVERED",
        note: note || "Refund detected & marked as recovered!",
        actor: "system",
      };

      const updates: Partial<Receivable> = {
        status: "RECOVERED",
        actualRefundDate: today,
        delayDays: diffDays,
        history: [newLog, ...(target.history || [])],
        updatedAt: now,
      };

      setReceivables((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));

      try {
        await updateDoc(doc(db, `users/${user.uid}/receivables`, id), updates);
      } catch (e) {
        console.warn("⚠️ Mark as recovered Firestore sync failed:", e);
      }
    },
    [user, receivables]
  );

  const deleteReceivable = useCallback(
    async (id: string) => {
      if (!user) return;

      // 1. Immediately update in-memory state and local AsyncStorage
      setReceivables((prev) => {
        const next = prev.filter((r) => r.id !== id);
        AsyncStorage.setItem(`@receivables_${user.uid}`, JSON.stringify(next)).catch(() => null);
        return next;
      });

      // 2. Track deleted ID persistently in local storage
      try {
        const deletedStr = await AsyncStorage.getItem(`@deleted_receivables_${user.uid}`);
        const deletedIds = deletedStr ? JSON.parse(deletedStr) : [];
        if (!deletedIds.includes(id)) {
          deletedIds.push(id);
          await AsyncStorage.setItem(`@deleted_receivables_${user.uid}`, JSON.stringify(deletedIds));
        }
      } catch (e) {
        console.warn("Local storage delete list write failed:", e);
      }

      // 3. Delete document from Firestore
      try {
        await deleteDoc(doc(db, `users/${user.uid}/receivables`, id));
      } catch (e) {
        console.warn("⚠️ Firestore delete failed:", e);
      }
    },
    [user]
  );

  const reconcileCreditSMS = useCallback(
    async (smsMerchant: string, amount: number, smsId?: string): Promise<boolean> => {
      const pending = receivables.filter((r) => r.status !== "RECOVERED" && r.status !== "CANCELLED");
      const matched = pending.find(
        (r) =>
          Math.abs(r.amount - amount) < 1 &&
          (r.merchant.toLowerCase().includes(smsMerchant.toLowerCase()) || smsMerchant.toLowerCase().includes(r.merchant.toLowerCase()))
      );

      if (matched) {
        await markAsRecovered(matched.id, `Auto-closed via bank credit SMS (${smsMerchant})`);
        return true;
      }
      return false;
    },
    [receivables, markAsRecovered]
  );

  const getPendingReceivables = useCallback(() => {
    return receivables.filter((r) => r.status !== "RECOVERED" && r.status !== "CANCELLED");
  }, [receivables]);

  const getTotalPendingAmount = useCallback(() => {
    return getPendingReceivables().reduce((sum, r) => sum + (r.amount || 0), 0);
  }, [getPendingReceivables]);

  const getTotalRecoveredAmount = useCallback(() => {
    return receivables
      .filter((r) => r.status === "RECOVERED")
      .reduce((sum, r) => sum + (r.amount || 0), 0);
  }, [receivables]);

  return (
    <ReceivablesContext.Provider
      value={{
        receivables,
        isLoading,
        addReceivable,
        updateReceivableStatus,
        addInteractionLog,
        markAsRecovered,
        deleteReceivable,
        getPendingReceivables,
        getTotalPendingAmount,
        getTotalRecoveredAmount,
        reconcileCreditSMS,
      }}
    >
      {children}
    </ReceivablesContext.Provider>
  );
}

export function useReceivables() {
  const ctx = useContext(ReceivablesContext);
  if (!ctx) throw new Error("useReceivables must be used within ReceivablesProvider");
  return ctx;
}
