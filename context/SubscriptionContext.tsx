import AsyncStorage from "@react-native-async-storage/async-storage";
import { addDoc, collection, doc, onSnapshot, serverTimestamp } from "firebase/firestore";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { db } from "@/lib/firebase";
import { safeHaptics } from "@/utils/haptics";
import * as Haptics from "expo-haptics";
import {
  DEFAULT_PLAN_CONFIG,
  hasActiveProAccess,
  normalizePlanConfig,
  resolveUserSubscription,
} from "@/utils/subscriptionModel";
import type {
  PlanConfig,
  SubscriptionPlan,
  SubscriptionTier,
  UserSubscription,
} from "@/utils/subscriptionModel";

export type { PlanConfig, SubscriptionPlan, SubscriptionTier, UserSubscription } from "@/utils/subscriptionModel";
export { hasActiveProAccess, normalizePlanConfig, resolveUserSubscription } from "@/utils/subscriptionModel";

interface SubscriptionContextValue {
  tier: SubscriptionTier;
  plan: SubscriptionPlan;
  isPro: boolean;
  isLifetime: boolean;
  expiresAt: number | null;
  planConfig: PlanConfig;
  paywallVisible: boolean;
  paywallFeature: string;
  openPaywall: (featureName?: string) => void;
  closePaywall: () => void;
  requirePro: (featureName: string, onAllowed?: () => void) => boolean;
  upgradePlan: (plan: "monthly" | "yearly", isTrial?: boolean) => Promise<boolean>;
  cancelSubscription: () => Promise<void>;
  loading: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [sub, setSub] = useState<UserSubscription>({
    tier: "free",
    plan: "free",
    status: "none",
    expiresAt: null,
  });
  const [planConfig, setPlanConfig] = useState<PlanConfig>(DEFAULT_PLAN_CONFIG);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [paywallFeature, setPaywallFeature] = useState("");
  const [loading, setLoading] = useState(true);

  // 1. Listen to dynamic plan configuration from Firestore
  useEffect(() => {
    const configDocRef = doc(db, "app_config", "subscription_plans");
    const unsubConfig = onSnapshot(
      configDocRef,
      (snap) => {
        if (snap.exists()) {
          setPlanConfig(normalizePlanConfig(snap.data() as Partial<PlanConfig>));
        }
      },
      (err) => {
        console.warn("[Subscription] Dynamic plan config snapshot notice:", err);
      }
    );

    return () => unsubConfig();
  }, []);

  // 2. Listen to User document for real-time subscription changes (e.g. upgraded by Admin or In-App)
  useEffect(() => {
    if (!user) {
      setSub({
        tier: "free",
        plan: "free",
        status: "none",
        expiresAt: null,
      });
      setLoading(false);
      return;
    }

    const userDocRef = doc(db, "users", user.uid);
    const unsubUser = onSnapshot(
      userDocRef,
      async (snap) => {
        if (snap.exists()) {
          const userData = snap.data();
          const subData = (userData?.subscription || {}) as Partial<UserSubscription>;
          const resolvedSub = resolveUserSubscription(subData);

          setSub(resolvedSub);
          await AsyncStorage.setItem(`@user_sub_${user.uid}`, JSON.stringify(resolvedSub));
        } else {
          setSub({
            tier: "free",
            plan: "free",
            status: "none",
            expiresAt: null,
          });
        }
        setLoading(false);
      },
      async (err) => {
        console.warn("[Subscription] User subscription snapshot failed, loading local cached state:", err);
        try {
          const cached = await AsyncStorage.getItem(`@user_sub_${user.uid}`);
          if (cached) setSub(JSON.parse(cached));
        } catch {
          // ignore
        }
        setLoading(false);
      }
    );

    return () => unsubUser();
  }, [user]);

  const isPro = hasActiveProAccess(sub);
  const isLifetime = !!sub.isLifetime;

  const openPaywall = (featureName?: string) => {
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPaywallFeature(featureName || "WhisperLedger Pro");
    setPaywallVisible(true);
  };

  const closePaywall = () => {
    setPaywallVisible(false);
  };

  /**
   * Helper that executes the callback if the user has Pro access,
   * otherwise opens the Paywall Modal.
   */
  const requirePro = (featureName: string, onAllowed?: () => void): boolean => {
    if (isPro) {
      if (onAllowed) onAllowed();
      return true;
    }
    openPaywall(featureName);
    return false;
  };

  /**
   * Creates an upgrade request. Actual entitlement changes must be performed
   * by admin/server code so users cannot self-grant Pro access.
   */
  const upgradePlan = async (plan: "monthly" | "yearly", isTrial = false): Promise<boolean> => {
    if (!user) return false;
    try {
      await addDoc(collection(db, "subscription_requests"), {
        userId: user.uid,
        email: user.email,
        requestedPlan: plan,
        requestType: isTrial ? "trial_request" : "upgrade_request",
        status: "pending",
        createdAt: Date.now(),
        createdAtServer: serverTimestamp(),
      });
      safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      closePaywall();
      return true;
    } catch (e) {
      console.error("[Subscription] Failed to create upgrade request:", e);
      return false;
    }
  };

  const cancelSubscription = async () => {
    if (!user) return;
    try {
      await addDoc(collection(db, "subscription_requests"), {
        userId: user.uid,
        email: user.email,
        requestType: "cancel_request",
        currentPlan: sub.plan,
        status: "pending",
        createdAt: Date.now(),
        createdAtServer: serverTimestamp(),
      });
    } catch (e) {
      console.error("[Subscription] Failed to create cancellation request:", e);
    }
  };

  return (
    <SubscriptionContext.Provider
      value={{
        tier: sub.tier,
        plan: sub.plan,
        isPro,
        isLifetime,
        expiresAt: sub.expiresAt || null,
        planConfig,
        paywallVisible,
        paywallFeature,
        openPaywall,
        closePaywall,
        requirePro,
        upgradePlan,
        cancelSubscription,
        loading,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error("useSubscription must be used within a SubscriptionProvider");
  }
  return context;
}
