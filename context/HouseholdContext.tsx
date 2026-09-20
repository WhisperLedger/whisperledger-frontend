import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  getDocs,
  arrayUnion,
  arrayRemove,
  deleteField,
  orderBy,
} from "firebase/firestore";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";
import { db } from "../lib/firebase";
import { logUserNotification, dismissAndClearNotification } from "@/utils/notifications";
import {
  DebtSummary,
  ExpenseSplit,
  Household,
  HouseholdExpense,
  HouseholdMember,
  MemberBalance,
} from "@/types/household";
import {
  calculateEqualSplits,
  calculateHouseholdBalances,
  calculatePairwiseDebts,
  generateInviteCode,
} from "@/utils/splitMath";

export type SpaceType = "personal" | "household";

export interface PendingSplitItem {
  expense: HouseholdExpense;
  split: ExpenseSplit;
}

interface HouseholdContextType {
  activeSpace: SpaceType;
  setActiveSpace: (space: SpaceType) => void;
  households: Household[];
  currentHousehold: Household | null;
  setCurrentHousehold: (household: Household | null) => void;
  householdExpenses: HouseholdExpense[];
  pendingSplits: PendingSplitItem[];
  balances: Record<string, MemberBalance>;
  pairwiseDebts: DebtSummary[];
  userNetBalance: number;
  isLoading: boolean;
  createHousehold: (name: string) => Promise<{ success: boolean; household?: Household; error?: string }>;
  joinHousehold: (inviteCode: string) => Promise<{ success: boolean; household?: Household; error?: string }>;
  leaveHousehold: (householdId: string, force?: boolean) => Promise<{ success: boolean; error?: string }>;
  deleteHousehold: (householdId: string) => Promise<{ success: boolean; error?: string }>;
  addHouseholdExpense: (
    data: Omit<HouseholdExpense, "id" | "createdAt" | "createdBy" | "createdByName" | "householdId">
  ) => Promise<{ success: boolean; error?: string }>;
  updateHouseholdExpense: (
    id: string,
    updates: Partial<HouseholdExpense>
  ) => Promise<{ success: boolean; error?: string }>;
  deleteHouseholdExpense: (id: string) => Promise<{ success: boolean; error?: string }>;
  acceptSplit: (expenseId: string) => Promise<{ success: boolean; error?: string }>;
  declineSplit: (expenseId: string) => Promise<{ success: boolean; error?: string }>;
  settleUp: (
    recipientUid: string,
    amount: number,
    notes?: string,
    payerUid?: string
  ) => Promise<{ success: boolean; error?: string }>;
}

const HouseholdContext = createContext<HouseholdContextType | null>(null);

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthReady } = useAuth();
  const [activeSpace, setActiveSpaceState] = useState<SpaceType>("personal");
  const [households, setHouseholds] = useState<Household[]>([]);
  const [currentHousehold, setCurrentHouseholdState] = useState<Household | null>(null);
  const [householdExpenses, setHouseholdExpenses] = useState<HouseholdExpense[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Keep personal as default space on every app launch
  useEffect(() => {
    setActiveSpaceState("personal");
  }, []);

  const setActiveSpace = useCallback((space: SpaceType) => {
    setActiveSpaceState(space);
    AsyncStorage.setItem("@active_space", space).catch(() => null);
  }, []);

  const setCurrentHousehold = useCallback((household: Household | null) => {
    setCurrentHouseholdState(household);
    if (household) {
      AsyncStorage.setItem("@active_household_id", household.id).catch(() => null);
    } else {
      AsyncStorage.removeItem("@active_household_id").catch(() => null);
    }
  }, []);

  // Listen for user's households
  useEffect(() => {
    if (!isAuthReady || !user) {
      setHouseholds([]);
      setCurrentHouseholdState(null);
      setHouseholdExpenses([]);
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, "households"),
      where("memberUids", "array-contains", user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const list: Household[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...(docSnap.data() as any) } as Household);
        });
        setHouseholds(list);
        await AsyncStorage.setItem(`@households_${user.uid}`, JSON.stringify(list)).catch(() => null);

        // If no active household selected, try restoring or picking the first one
        if (list.length > 0) {
          const storedId = await AsyncStorage.getItem("@active_household_id").catch(() => null);
          const matched = list.find((h) => h.id === storedId) || list[0];
          setCurrentHouseholdState(matched);
        } else {
          setCurrentHouseholdState(null);
        }
        setIsLoading(false);
      },
      async (err) => {
        console.warn("⚠️ Households snapshot listener error, falling back to cache:", err);
        try {
          const cached = await AsyncStorage.getItem(`@households_${user.uid}`);
          if (cached) {
            const list = JSON.parse(cached) as Household[];
            setHouseholds(list);
            if (list.length > 0) {
              const storedId = await AsyncStorage.getItem("@active_household_id").catch(() => null);
              const matched = list.find((h) => h.id === storedId) || list[0];
              setCurrentHouseholdState(matched);
            }
          }
        } catch {
          // ignore
        }
        setIsLoading(false);
      }
    );

    return unsubscribe;
  }, [user, isAuthReady]);

  // Listen for active household expenses
  useEffect(() => {
    if (!currentHousehold) {
      setHouseholdExpenses([]);
      return;
    }

    const q = query(
      collection(db, `households/${currentHousehold.id}/expenses`),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loaded: HouseholdExpense[] = [];
        snapshot.forEach((docSnap) => {
          loaded.push({ id: docSnap.id, ...(docSnap.data() as any) } as HouseholdExpense);
        });
        setHouseholdExpenses(loaded);
        AsyncStorage.setItem(`@household_expenses_${currentHousehold.id}`, JSON.stringify(loaded)).catch(() => null);
      },
      async (err) => {
        console.warn("⚠️ Household expenses snapshot error, falling back to cache:", err);
        try {
          const cached = await AsyncStorage.getItem(`@household_expenses_${currentHousehold.id}`);
          if (cached) {
            setHouseholdExpenses(JSON.parse(cached) as HouseholdExpense[]);
          }
        } catch {
          // ignore
        }
      }
    );

    return unsubscribe;
  }, [currentHousehold]);

  // Calculate balances & debts
  const balances = useMemo(() => {
    if (!currentHousehold) return {};
    return calculateHouseholdBalances(currentHousehold.members || {}, householdExpenses);
  }, [currentHousehold, householdExpenses]);

  const pairwiseDebts = useMemo(() => {
    return calculatePairwiseDebts(balances);
  }, [balances]);

  const userNetBalance = useMemo(() => {
    if (!user || !balances[user.uid]) return 0;
    return balances[user.uid].netBalance;
  }, [user, balances]);

  // Create Household
  const createHousehold = useCallback(
    async (name: string): Promise<{ success: boolean; household?: Household; error?: string }> => {
      if (!user) return { success: false, error: "Not logged in" };
      const trimmedName = name.trim();
      if (!trimmedName) return { success: false, error: "Household name is required" };

      const inviteCode = generateInviteCode();
      const memberInfo: HouseholdMember = {
        uid: user.uid,
        name: user.name || "User",
        email: user.email || "",
        avatarUri: user.avatarUri || "",
        role: "admin",
        joinedAt: Date.now(),
      };

      const householdId = inviteCode;
      const householdData = {
        name: trimmedName,
        createdBy: user.uid,
        createdAt: Date.now(),
        inviteCode,
        members: {
          [user.uid]: memberInfo,
        },
        memberUids: [user.uid],
      };

      const newHousehold: Household = { id: householdId, ...householdData };
      setCurrentHousehold(newHousehold);
      setHouseholds((prev) => [newHousehold, ...prev.filter((h) => h.id !== householdId)]);
      setActiveSpaceState("household");
      await AsyncStorage.setItem("@active_household_id", householdId).catch(() => null);

      try {
        await setDoc(doc(db, "households", householdId), householdData, { merge: true });
        await AsyncStorage.setItem(`@households_${user.uid}`, JSON.stringify([newHousehold, ...households.filter((h) => h.id !== householdId)])).catch(() => null);
        return { success: true, household: newHousehold };
      } catch (err: any) {
        console.warn("⚠️ Cloud sync issue (deploy firestore.rules if needed), saved locally:", err?.message);
        await AsyncStorage.setItem(`@households_${user.uid}`, JSON.stringify([newHousehold, ...households.filter((h) => h.id !== householdId)])).catch(() => null);
        return { success: true, household: newHousehold };
      }
    },
    [user, households, setCurrentHousehold]
  );

  // Join Household via Invite Code
  const joinHousehold = useCallback(
    async (inviteCode: string): Promise<{ success: boolean; household?: Household; error?: string }> => {
      if (!user) return { success: false, error: "Not logged in" };
      const cleanCode = inviteCode.trim().toUpperCase();
      if (!cleanCode) return { success: false, error: "Please enter an invite code" };

      let targetDocId: string | null = null;
      let data: Household | null = null;
      let lastCloudError: string | null = null;

      // 1. Direct document get by ID (since ID === inviteCode)
      try {
        const directDoc = await getDoc(doc(db, "households", cleanCode));
        if (directDoc.exists()) {
          targetDocId = directDoc.id;
          data = directDoc.data() as Household;
        }
      } catch (err: any) {
        console.warn("⚠️ Direct get household cloud check:", err?.message);
        lastCloudError = err?.message || null;
      }

      // 2. Query by inviteCode field if direct ID lookup didn't find it
      if (!data) {
        try {
          const q = query(collection(db, "households"), where("inviteCode", "==", cleanCode));
          const snap = await getDocs(q);

          if (!snap.empty) {
            const docSnap = snap.docs[0];
            targetDocId = docSnap.id;
            data = docSnap.data() as Household;
          }
        } catch (err: any) {
          console.warn("⚠️ Query households cloud check:", err?.message);
          lastCloudError = err?.message || lastCloudError;
        }
      }

      // 3. Check locally cached households if cloud query is unavailable
      if (!data) {
        const localMatch = households.find((h) => h.inviteCode?.toUpperCase() === cleanCode);
        if (localMatch) {
          data = localMatch;
          targetDocId = localMatch.id;
        }
      }

      if (!data || !targetDocId) {
        if (lastCloudError && (lastCloudError.includes("permission") || lastCloudError.includes("denied"))) {
          return {
            success: false,
            error: `Firebase Cloud Permissions Error.\n\nPlease open Firebase Console -> Firestore Database -> Rules and publish the rule for 'households'.\n\nError: ${lastCloudError}`,
          };
        }
        return {
          success: false,
          error: `No household found with invite code "${cleanCode}".\n\nPlease make sure the code is correct and that the flat creator created it while online.`,
        };
      }

      if (data.memberUids?.includes(user.uid)) {
        const joined: Household = { ...data, id: targetDocId };
        setCurrentHousehold(joined);
        setActiveSpaceState("household");
        await AsyncStorage.setItem("@active_household_id", targetDocId).catch(() => null);
        return { success: true, household: joined };
      }

      const memberInfo: HouseholdMember = {
        uid: user.uid,
        name: user.name || "User",
        email: user.email || "",
        avatarUri: user.avatarUri || "",
        role: "member",
        joinedAt: Date.now(),
      };

      const updatedMembers = { ...(data.members || {}), [user.uid]: memberInfo };
      const updatedMemberUids = Array.from(new Set([...(data.memberUids || []), user.uid]));

      const updatedHousehold: Household = {
        ...data,
        id: targetDocId,
        members: updatedMembers,
        memberUids: updatedMemberUids,
      };

      setHouseholds((prev) => [updatedHousehold, ...prev.filter((h) => h.id !== targetDocId)]);
      setCurrentHousehold(updatedHousehold);
      setActiveSpaceState("household");
      await AsyncStorage.setItem("@active_household_id", targetDocId).catch(() => null);
      await AsyncStorage.setItem(
        `@households_${user.uid}`,
        JSON.stringify([updatedHousehold, ...households.filter((h) => h.id !== targetDocId)])
      ).catch(() => null);

      try {
        await setDoc(
          doc(db, "households", targetDocId),
          {
            members: updatedMembers,
            memberUids: updatedMemberUids,
          },
          { merge: true }
        );
      } catch (err: any) {
        console.warn("⚠️ Firestore cloud update pending rules deployment, saved locally:", err?.message);
      }

      return { success: true, household: updatedHousehold };
    },
    [user, households, setCurrentHousehold]
  );

  // Delete Household (Admin/Creator only)
  const deleteHousehold = useCallback(
    async (householdId: string): Promise<{ success: boolean; error?: string }> => {
      if (!user) return { success: false, error: "Not logged in" };
      const target = households.find((h) => h.id === householdId);
      if (!target) return { success: false, error: "Household not found" };

      // 1. Update local state and AsyncStorage immediately
      const remaining = households.filter((h) => h.id !== householdId);
      setHouseholds(remaining);
      const nextHousehold = remaining.length > 0 ? remaining[0] : null;
      setCurrentHousehold(nextHousehold);
      setHouseholdExpenses([]);
      if (nextHousehold) {
        AsyncStorage.setItem("@active_household_id", nextHousehold.id).catch(() => null);
      } else {
        AsyncStorage.removeItem("@active_household_id").catch(() => null);
        setActiveSpaceState("personal");
      }
      await AsyncStorage.setItem(`@households_${user.uid}`, JSON.stringify(remaining)).catch(() => null);

      // 2. Cloud delete in Firestore
      try {
        await deleteDoc(doc(db, "households", householdId));
      } catch (err: any) {
        console.warn("⚠️ Delete household cloud sync error, deleted locally:", err?.message);
      }

      return { success: true };
    },
    [user, households, setCurrentHousehold]
  );

  // Leave Household
  const leaveHousehold = useCallback(
    async (householdId: string, force = false): Promise<{ success: boolean; error?: string }> => {
      if (!user) return { success: false, error: "Not logged in" };
      const target = households.find((h) => h.id === householdId);
      if (!target) return { success: false, error: "Household not found" };

      const memberCount = Object.keys(target.members || {}).length;
      if (memberCount <= 1 || target.createdBy === user.uid) {
        // If user is creator or sole member, delete the household cleanly
        return deleteHousehold(householdId);
      }

      // Check unsettled balance only if not forced
      const memberBal = balances[user.uid]?.netBalance || 0;
      if (!force && Math.abs(memberBal) > 0.05) {
        return {
          success: false,
          error: `You have an unsettled balance of ₹${Math.abs(memberBal).toFixed(2)}. Please settle all dues or confirm leave.`,
        };
      }

      // 1. Update local state and AsyncStorage immediately
      const remaining = households.filter((h) => h.id !== householdId);
      setHouseholds(remaining);
      const nextHousehold = remaining.length > 0 ? remaining[0] : null;
      setCurrentHousehold(nextHousehold);
      if (nextHousehold) {
        AsyncStorage.setItem("@active_household_id", nextHousehold.id).catch(() => null);
      } else {
        AsyncStorage.removeItem("@active_household_id").catch(() => null);
        setActiveSpaceState("personal");
      }
      await AsyncStorage.setItem(`@households_${user.uid}`, JSON.stringify(remaining)).catch(() => null);

      // 2. Cloud sync in Firestore
      try {
        await updateDoc(doc(db, "households", householdId), {
          [`members.${user.uid}`]: deleteField(),
          memberUids: arrayRemove(user.uid),
        });
      } catch (err: any) {
        console.warn("⚠️ Leave household cloud sync pending rules deployment, removed locally:", err?.message);
      }

      return { success: true };
    },
    [user, households, balances, setCurrentHousehold, deleteHousehold]
  );

  const pendingSplits: PendingSplitItem[] = useMemo(() => {
    if (!user) return [];
    const list: PendingSplitItem[] = [];
    (householdExpenses || []).forEach((exp) => {
      if (exp.splits && Array.isArray(exp.splits) && !exp.isSettlement) {
        const mySplit = exp.splits.find(
          (s) => s.uid === user.uid && s.status === "pending"
        );
        if (mySplit && exp.payerUid !== user.uid) {
          list.push({ expense: exp, split: mySplit });
        }
      }
    });
    return list;
  }, [householdExpenses, user]);

  // Add Household Expense with Split Approval workflow
  const addHouseholdExpense = useCallback(
    async (
      data: Omit<HouseholdExpense, "id" | "createdAt" | "createdBy" | "createdByName" | "householdId">
    ): Promise<{ success: boolean; error?: string }> => {
      if (!user || !currentHousehold) return { success: false, error: "No active household" };

      const timestamp = Date.now();
      const expenseId = Math.random().toString(36).substring(2, 9) + timestamp;

      // Assign initial approval status: Payer is accepted, other flatmates are pending
      const normalizedSplits = (data.splits || []).map((split) => ({
        ...split,
        status: (split.uid === user.uid ? "accepted" : "pending") as "accepted" | "pending",
      }));

      const newExpense: HouseholdExpense = {
        ...data,
        splits: normalizedSplits,
        id: expenseId,
        householdId: currentHousehold.id,
        createdBy: user.uid,
        createdByName: user.name || "User",
        createdAt: timestamp,
      };

      // Optimistic update
      setHouseholdExpenses((prev) => [newExpense, ...prev]);

      try {
        // 1. Write master record in households/{householdId}/expenses/{expenseId}
        await setDoc(doc(db, `households/${currentHousehold.id}/expenses`, expenseId), newExpense);

        // 2. Personal Sync: Write creator/payer share immediately, and notify other flatmates
        const syncPromises = normalizedSplits.map(async (split) => {
          if (split.uid === user.uid) {
            const personalExpenseId = `hh_${expenseId}_${split.uid}`;
            const personalNote = `[${currentHousehold.name}] ${data.note.trim() || "Shared Expense"}`;
            const personalExpenseData = {
              amount: split.share,
              categoryId: data.categoryId,
              paymentMode: data.paymentMode,
              note: personalNote,
              merchant: data.merchant || "",
              date: data.date,
              createdAt: timestamp,
              householdExpenseId: expenseId,
              householdId: currentHousehold.id,
              isHouseholdSplitShare: true,
              householdCreatedBy: user.uid,
              householdPayerUid: data.payerUid,
              householdPayerName: data.payerName,
            };
            return setDoc(doc(db, `users/${split.uid}/expenses`, personalExpenseId), personalExpenseData);
          } else {
            // Send split approval notification to flatmate
            return logUserNotification({
              userId: split.uid,
              notificationId: `split_req_${expenseId}_${split.uid}`,
              title: `🤝 New Split Request: ${data.note || "Shared Expense"}`,
              body: `${user.name || "A flatmate"} added a ₹${Number(data.amount || 0).toFixed(0)} spend in ${currentHousehold.name}. Your share: ₹${Number(split.share || 0).toFixed(0)}. Accept to add to your ledger.`,
              notificationType: "split_request",
              data: {
                expenseId,
                householdId: currentHousehold.id,
                householdName: currentHousehold.name,
                amount: split.share,
                totalAmount: data.amount,
                payerName: data.payerName || user.name,
                note: data.note,
              },
            }).catch(() => null);
          }
        });

        await Promise.all(syncPromises);
        return { success: true };
      } catch (err: any) {
        console.error("Add household expense error:", err);
        return { success: false, error: err.message || "Failed to save household expense" };
      }
    },
    [user, currentHousehold]
  );

  const acceptSplit = useCallback(
    async (expenseId: string): Promise<{ success: boolean; error?: string }> => {
      if (!user || !currentHousehold) return { success: false, error: "No active household" };
      const existing = householdExpenses.find((e) => e.id === expenseId);
      if (!existing) return { success: false, error: "Expense not found" };

      const mySplit = (existing.splits || []).find((s) => s.uid === user.uid);
      if (!mySplit) return { success: false, error: "Split not found" };

      const updatedSplits = (existing.splits || []).map((s) =>
        s.uid === user.uid ? { ...s, status: "accepted" as const } : s
      );

      const updatedExpense: HouseholdExpense = {
        ...existing,
        splits: updatedSplits,
        updatedAt: Date.now(),
      };

      setHouseholdExpenses((prev) =>
        prev.map((e) => (e.id === expenseId ? updatedExpense : e))
      );

      try {
        await setDoc(doc(db, `households/${currentHousehold.id}/expenses`, expenseId), updatedExpense, { merge: true });

        // Add to user's personal ledger
        const personalExpenseId = `hh_${expenseId}_${user.uid}`;
        const personalNote = `[${currentHousehold.name}] ${existing.note.trim() || "Shared Expense"}`;
        const personalExpenseData = {
          amount: mySplit.share,
          categoryId: existing.categoryId,
          paymentMode: existing.paymentMode,
          note: personalNote,
          merchant: existing.merchant || "",
          date: existing.date,
          createdAt: existing.createdAt,
          householdExpenseId: expenseId,
          householdId: currentHousehold.id,
          isHouseholdSplitShare: true,
          householdCreatedBy: existing.createdBy,
          householdPayerUid: existing.payerUid,
          householdPayerName: existing.payerName,
        };
        await setDoc(doc(db, `users/${user.uid}/expenses`, personalExpenseId), personalExpenseData);

        // Clear push notification from device tray and mark resolved
        const notifId = `split_req_${expenseId}_${user.uid}`;
        dismissAndClearNotification(notifId, user.uid).catch(() => null);

        return { success: true };
      } catch (err: any) {
        console.error("Accept split error:", err);
        return { success: false, error: err?.message || "Failed to accept split" };
      }
    },
    [user, currentHousehold, householdExpenses]
  );

  const declineSplit = useCallback(
    async (expenseId: string): Promise<{ success: boolean; error?: string }> => {
      if (!user || !currentHousehold) return { success: false, error: "No active household" };
      const existing = householdExpenses.find((e) => e.id === expenseId);
      if (!existing) return { success: false, error: "Expense not found" };

      const updatedSplits = (existing.splits || []).map((s) =>
        s.uid === user.uid ? { ...s, status: "declined" as const } : s
      );

      const updatedExpense: HouseholdExpense = {
        ...existing,
        splits: updatedSplits,
        updatedAt: Date.now(),
      };

      setHouseholdExpenses((prev) =>
        prev.map((e) => (e.id === expenseId ? updatedExpense : e))
      );

      try {
        await setDoc(doc(db, `households/${currentHousehold.id}/expenses`, expenseId), updatedExpense, { merge: true });

        // Clear push notification from device tray and mark resolved
        const notifId = `split_req_${expenseId}_${user.uid}`;
        dismissAndClearNotification(notifId, user.uid).catch(() => null);

        return { success: true };
      } catch (err: any) {
        console.error("Decline split error:", err);
        return { success: false, error: err?.message || "Failed to decline split" };
      }
    },
    [user, currentHousehold, householdExpenses]
  );

  // Update Household Expense (Creator only)
  const updateHouseholdExpense = useCallback(
    async (id: string, updates: Partial<HouseholdExpense>): Promise<{ success: boolean; error?: string }> => {
      if (!user || !currentHousehold) return { success: false, error: "No active household" };

      const existing = householdExpenses.find((e) => e.id === id);
      if (!existing) return { success: false, error: "Expense not found" };

      if (existing.createdBy !== user.uid) {
        return { success: false, error: "You can only edit expenses you added." };
      }

      const merged: HouseholdExpense = { ...existing, ...updates, updatedAt: Date.now() };

      // Optimistic update
      setHouseholdExpenses((prev) => prev.map((e) => (e.id === id ? merged : e)));

      try {
        // 1. Update household expense doc
        await setDoc(doc(db, `households/${currentHousehold.id}/expenses`, id), merged);

        // 2. Update all participants' personal split shares
        if (Array.isArray(merged.splits)) {
          const updatePromises = merged.splits.map(async (split) => {
            const personalExpenseId = `hh_${id}_${split.uid}`;
            const personalNote = `[${currentHousehold.name}] ${merged.note.trim() || "Shared Expense"}`;
            const personalExpenseData = {
              amount: split.share,
              categoryId: merged.categoryId,
              paymentMode: merged.paymentMode,
              note: personalNote,
              merchant: merged.merchant || "",
              date: merged.date,
              createdAt: merged.createdAt,
              householdExpenseId: id,
              householdId: currentHousehold.id,
              isHouseholdSplitShare: true,
              householdCreatedBy: merged.createdBy,
              householdPayerUid: merged.payerUid,
              householdPayerName: merged.payerName,
            };

            return setDoc(doc(db, `users/${split.uid}/expenses`, personalExpenseId), personalExpenseData);
          });
          await Promise.all(updatePromises);
        }

        return { success: true };
      } catch (err: any) {
        console.error("Update household expense error:", err);
        return { success: false, error: err.message || "Failed to update expense" };
      }
    },
    [user, currentHousehold, householdExpenses]
  );

  // Delete Household Expense (Creator only)
  const deleteHouseholdExpense = useCallback(
    async (id: string): Promise<{ success: boolean; error?: string }> => {
      if (!user || !currentHousehold) return { success: false, error: "No active household" };

      const existing = householdExpenses.find((e) => e.id === id);
      if (!existing) return { success: false, error: "Expense not found" };

      if (existing.createdBy !== user.uid) {
        return { success: false, error: "You can only delete expenses you added." };
      }

      // Optimistic update
      setHouseholdExpenses((prev) => prev.filter((e) => e.id !== id));

      try {
        // 1. Delete household expense doc
        await deleteDoc(doc(db, `households/${currentHousehold.id}/expenses`, id));

        // 2. Delete synced personal records from all participants
        if (Array.isArray(existing.splits)) {
          const deletePromises = existing.splits.map((split) => {
            const personalExpenseId = `hh_${id}_${split.uid}`;
            return deleteDoc(doc(db, `users/${split.uid}/expenses`, personalExpenseId));
          });
          await Promise.all(deletePromises);
        }

        return { success: true };
      } catch (err: any) {
        console.error("Delete household expense error:", err);
        return { success: false, error: err.message || "Failed to delete expense" };
      }
    },
    [user, currentHousehold, householdExpenses]
  );

  // Settle Up
  const settleUp = useCallback(
    async (
      recipientUid: string,
      amount: number,
      notes?: string,
      payerUid?: string
    ): Promise<{ success: boolean; error?: string }> => {
      if (!user || !currentHousehold) return { success: false, error: "No active household" };
      if (!recipientUid || amount <= 0) return { success: false, error: "Invalid settlement parameters" };

      const actualPayerUid = payerUid || user.uid;
      const actualPayerName =
        currentHousehold.members[actualPayerUid]?.name ||
        (actualPayerUid === user.uid ? user.name || "User" : "Flatmate");

      const recipient = currentHousehold.members[recipientUid];
      const recipientName = recipient?.name || "Flatmate";
      const timestamp = Date.now();
      const settlementId = "settle_" + Math.random().toString(36).substring(2, 9) + timestamp;

      const settlementExpense: HouseholdExpense = {
        id: settlementId,
        householdId: currentHousehold.id,
        createdBy: user.uid,
        createdByName: user.name || "User",
        amount,
        categoryId: "transfer",
        paymentMode: "upi",
        note: notes?.trim() || `${actualPayerName} settled with ${recipientName}`,
        date: new Date().toISOString().split("T")[0],
        createdAt: timestamp,
        payerUid: actualPayerUid,
        payerName: actualPayerName,
        splitType: "equal",
        splits: [],
        isSettlement: true,
        settlementDetails: {
          recipientUid,
          recipientName,
        },
      };

      setHouseholdExpenses((prev) => [settlementExpense, ...prev]);

      try {
        await setDoc(doc(db, `households/${currentHousehold.id}/expenses`, settlementId), settlementExpense);
        return { success: true };
      } catch (err: any) {
        console.error("Settle up error:", err);
        return { success: false, error: err.message || "Failed to record settlement" };
      }
    },
    [user, currentHousehold]
  );

  return (
    <HouseholdContext.Provider
      value={{
        activeSpace,
        setActiveSpace,
        households,
        currentHousehold,
        setCurrentHousehold,
        householdExpenses,
        pendingSplits,
        balances,
        pairwiseDebts,
        userNetBalance,
        isLoading,
        createHousehold,
        joinHousehold,
        leaveHousehold,
        deleteHousehold,
        addHouseholdExpense,
        updateHouseholdExpense,
        deleteHouseholdExpense,
        acceptSplit,
        declineSplit,
        settleUp,
      }}
    >
      {children}
    </HouseholdContext.Provider>
  );
}

const defaultHouseholdState: HouseholdContextType = {
  activeSpace: "personal",
  setActiveSpace: () => {},
  households: [],
  currentHousehold: null,
  setCurrentHousehold: () => {},
  householdExpenses: [],
  pendingSplits: [],
  balances: {},
  pairwiseDebts: [],
  userNetBalance: 0,
  isLoading: false,
  createHousehold: async () => ({ success: false, error: "Not initialized" }),
  joinHousehold: async () => ({ success: false, error: "Not initialized" }),
  leaveHousehold: async () => ({ success: false, error: "Not initialized" }),
  deleteHousehold: async () => ({ success: false, error: "Not initialized" }),
  addHouseholdExpense: async () => ({ success: false, error: "Not initialized" }),
  updateHouseholdExpense: async () => ({ success: false, error: "Not initialized" }),
  deleteHouseholdExpense: async () => ({ success: false, error: "Not initialized" }),
  acceptSplit: async () => ({ success: false, error: "Not initialized" }),
  declineSplit: async () => ({ success: false, error: "Not initialized" }),
  settleUp: async () => ({ success: false, error: "Not initialized" }),
};

export function useHousehold() {
  const ctx = useContext(HouseholdContext);
  return ctx || defaultHouseholdState;
}
