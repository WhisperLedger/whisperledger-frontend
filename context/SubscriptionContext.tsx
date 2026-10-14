import AsyncStorage from "@react-native-async-storage/async-storage";
import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, where } from "firebase/firestore";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { db } from "@/lib/firebase";
import { api } from "@/lib/api";
import { runtimeConfig } from "@/config/runtime";
import { safeHaptics } from "@/utils/haptics";
import * as Haptics from "expo-haptics";
import {
  DEFAULT_PLAN_CONFIG,
  hasActiveProAccess,
  isUpgradeablePlan,
  normalizePlanConfig,
  resolveEffectiveSubscription,
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
  trialUsed: boolean;
  expiresAt: number | null;
  planConfig: PlanConfig;
  paywallVisible: boolean;
  paywallFeature: string;
  pendingProRequest: boolean;
  pendingProPlan: "monthly" | "yearly" | null;
  openPaywall: (featureName?: string) => void;
  closePaywall: () => void;
  requirePro: (featureName: string, onAllowed?: () => void) => boolean;
  upgradePlan: (plan: "monthly" | "yearly", isTrial?: boolean) => Promise<boolean>;
  startTrial: () => Promise<boolean>;
  cancelSubscription: () => Promise<void>;
  loading: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

const subscriptionStorageKey = (uid: string) => `@user_sub_${uid}`;

async function loadCachedSubscription(uid: string): Promise<UserSubscription | null> {
  try {
    const cached = await AsyncStorage.getItem(subscriptionStorageKey(uid));
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

async function cacheSubscription(uid: string, subscription: UserSubscription) {
  await AsyncStorage.setItem(subscriptionStorageKey(uid), JSON.stringify(subscription));
}

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
  const [pendingProRequest, setPendingProRequest] = useState(false);
  const [pendingProPlan, setPendingProPlan] = useState<"monthly" | "yearly" | null>(null);
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

  // 2. Listen to User document / API for subscription status (e.g. upgraded by Admin or In-App)
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

    // Check if user object already carries Pro entitlement
    if (user.isPro === true || user.plan === "pro") {
      const proSub: UserSubscription = {
        tier: "pro",
        plan: "yearly",
        status: "active",
        expiresAt: null,
      };
      setSub(proSub);
      cacheSubscription(user.uid, proSub).catch(() => null);
      setLoading(false);
    }

    // When connecting to PostgreSQL API backend, fetch entitlements directly from /auth/me
    if (runtimeConfig.dataBackend === "api") {
      api.getMe().then(async (res) => {
        const apiUser = res.data?.user || (res.data?.id ? res.data : null);
        if (apiUser && (apiUser.plan === "pro" || apiUser.isPro === true)) {
          const proSub: UserSubscription = {
            tier: "pro",
            plan: "yearly",
            status: "active",
            expiresAt: null,
          };
          setSub(proSub);
          await cacheSubscription(user.uid, proSub);
        } else if (apiUser) {
          const freeSub: UserSubscription = {
            tier: "free",
            plan: "free",
            status: "none",
            expiresAt: null,
          };
          setSub(freeSub);
          await cacheSubscription(user.uid, freeSub);
        }
      }).catch((err) => {
        console.warn("[Subscription] API getMe subscription check fallback:", err);
      }).finally(() => {
        setLoading(false);
      });
      return;
    }

    const userDocRef = doc(db, "users", user.uid);
    const unsubUser = onSnapshot(
      userDocRef,
      async (snap) => {
        if (snap.exists()) {
          const userData = snap.data();
          let subData = { ...((userData?.subscription || {}) as Partial<UserSubscription>) };

          // Fallback: If root user document has isPro or plan: "pro", ensure subData reflects it
          if (subData.tier !== "pro" && (userData?.isPro === true || userData?.plan === "pro" || (userData?.adminControls as any)?.isPro === true)) {
            subData.tier = "pro";
            subData.status = "active";
            subData.plan = subData.plan && subData.plan !== "free" ? subData.plan : (userData?.subscriptionPlan || "yearly");
          }

          const resolvedSub = resolveUserSubscription(subData);

          setSub(resolvedSub);
          await cacheSubscription(user.uid, resolvedSub);
        } else {
          // If Firestore user doc doesn't exist yet, check user object before defaulting to free
          if (user.isPro === true || user.plan === "pro") {
            const proSub: UserSubscription = {
              tier: "pro",
              plan: "yearly",
              status: "active",
              expiresAt: null,
            };
            setSub(proSub);
            await cacheSubscription(user.uid, proSub);
          } else {
            const freeSub: UserSubscription = {
              tier: "free",
              plan: "free",
              status: "none",
              expiresAt: null,
            };
            setSub(freeSub);
            await cacheSubscription(user.uid, freeSub);
          }
        }
        setLoading(false);
      },
      async (err) => {
        console.warn("[Subscription] User subscription snapshot failed, loading local cached state:", err);
        const cached = await loadCachedSubscription(user.uid);
        if (cached) setSub(resolveEffectiveSubscription(undefined, cached));
        setLoading(false);
      }
    );

    return () => unsubUser();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setPendingProRequest(false);
      setPendingProPlan(null);
      return;
    }

    const requestsQuery = query(
      collection(db, "subscription_requests"),
      where("userId", "==", user.uid),
      where("status", "==", "pending")
    );
    const unsubRequests = onSnapshot(
      requestsQuery,
      (snap) => {
        const pendingRequest = snap.docs
          .map((requestDoc) => requestDoc.data() as { requestedPlan?: unknown; requestType?: string })
          .find((request) => request.requestType !== "cancel_request");
        const requestedPlan = pendingRequest?.requestedPlan;
        setPendingProRequest(!!pendingRequest);
        setPendingProPlan(isUpgradeablePlan(requestedPlan) ? requestedPlan : null);
      },
      (err) => {
        console.warn("[Subscription] Pending subscription request snapshot failed:", err);
      }
    );

    return () => unsubRequests();
  }, [user]);

  const isPro = hasActiveProAccess(sub);
  const isLifetime = !!sub.isLifetime;
  const trialUsed = !!sub.trialUsed;

  useEffect(() => {
    if (isPro && paywallVisible) {
      setPaywallVisible(false);
    }
  }, [isPro, paywallVisible]);

  const openPaywall = (featureName?: string) => {
    if (isPro) {
      setPaywallVisible(false);
      return;
    }
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

  const createAccessRequest = async (
    requestType: "trial_activation" | "upgrade_activation",
    requestedPlan: "trial" | "monthly" | "yearly"
  ): Promise<boolean> => {
    if (!user) return false;
    try {
      await addDoc(collection(db, "subscription_requests"), {
        userId: user.uid,
        email: user.email,
        requestedPlan,
        requestType,
        // A client may request access; only trusted billing/admin services can
        // approve it and write a subscription entitlement.
        status: "pending",
        paymentStatus: requestType === "trial_activation" ? "not_required" : "not_started",
        source: "mobile_app",
        createdAt: Date.now(),
        createdAtServer: serverTimestamp(),
      });
      safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } catch (e) {
      console.error("[Subscription] Failed to create access request:", e);
      return false;
    }
  };

  const startTrial = async (): Promise<boolean> => {
    if (!user || isPro || trialUsed || pendingProRequest) return false;
    return createAccessRequest("trial_activation", "trial");
  };

  /** Creates a request; a verified billing or admin service grants access. */
  const upgradePlan = async (plan: "monthly" | "yearly", isTrial = false): Promise<boolean> => {
    if (!user) return false;
    if (isTrial) return startTrial();
    if (isPro) {
      closePaywall();
      return true;
    }
    if (!isUpgradeablePlan(plan)) return false;

    if (pendingProRequest) return false;
    return createAccessRequest("upgrade_activation", plan);
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
        trialUsed,
        expiresAt: sub.expiresAt || null,
        planConfig,
        paywallVisible,
        paywallFeature,
        pendingProRequest,
        pendingProPlan,
        openPaywall,
        closePaywall,
        requirePro,
        upgradePlan,
        startTrial,
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
