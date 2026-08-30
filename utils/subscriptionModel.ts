export type SubscriptionTier = "free" | "pro";
export type SubscriptionPlan = "free" | "monthly" | "yearly" | "lifetime" | "trial";

export interface PlanConfig {
  monthlyPrice: number;
  yearlyPrice: number;
  discountPercentage: number;
  trialDays: number;
  promoBanner: string;
  freeSmsLookbackLimit: number;
  freeRefundCaseLimit: number;
  freeBudgetLimit: number;
}

export interface UserSubscription {
  tier: SubscriptionTier;
  plan: SubscriptionPlan;
  status: "active" | "canceled" | "expired" | "none";
  startedAt?: number;
  expiresAt?: number | null;
  isLifetime?: boolean;
  trialUsed?: boolean;
}

export const DEFAULT_PLAN_CONFIG: PlanConfig = {
  monthlyPrice: 99,
  yearlyPrice: 799,
  discountPercentage: 33,
  trialDays: 7,
  promoBanner: "Launch Offer: 7 Days Free Trial on All Pro Features",
  freeSmsLookbackLimit: 10,
  freeRefundCaseLimit: 2,
  freeBudgetLimit: 1,
};

export function normalizePlanConfig(data?: Partial<PlanConfig>): PlanConfig {
  const intOrDefault = (value: unknown, fallback: number, min = 0, max = 100000) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, Math.round(parsed)));
  };

  return {
    monthlyPrice: intOrDefault(data?.monthlyPrice, DEFAULT_PLAN_CONFIG.monthlyPrice, 1),
    yearlyPrice: intOrDefault(data?.yearlyPrice, DEFAULT_PLAN_CONFIG.yearlyPrice, 1),
    discountPercentage: intOrDefault(data?.discountPercentage, DEFAULT_PLAN_CONFIG.discountPercentage, 0, 90),
    trialDays: intOrDefault(data?.trialDays, DEFAULT_PLAN_CONFIG.trialDays, 0, 30),
    promoBanner: String(data?.promoBanner || DEFAULT_PLAN_CONFIG.promoBanner),
    freeSmsLookbackLimit: intOrDefault(data?.freeSmsLookbackLimit, DEFAULT_PLAN_CONFIG.freeSmsLookbackLimit, 0, 100),
    freeRefundCaseLimit: intOrDefault(data?.freeRefundCaseLimit, DEFAULT_PLAN_CONFIG.freeRefundCaseLimit, 0, 100),
    freeBudgetLimit: intOrDefault(data?.freeBudgetLimit, DEFAULT_PLAN_CONFIG.freeBudgetLimit, 0, 100),
  };
}

export function hasActiveProAccess(subscription?: Partial<UserSubscription>, now = Date.now()): boolean {
  if (!subscription || subscription.tier !== "pro") return false;
  if (subscription.isLifetime || subscription.plan === "lifetime") return true;
  if (subscription.status !== "active") return false;
  return !subscription.expiresAt || now <= subscription.expiresAt;
}

export function resolveUserSubscription(subscription?: Partial<UserSubscription>, now = Date.now()): UserSubscription {
  if (!hasActiveProAccess(subscription, now)) {
    return {
      tier: "free",
      plan: "free",
      status: subscription?.status === "expired" ? "expired" : "none",
      startedAt: subscription?.startedAt,
      expiresAt: subscription?.expiresAt || null,
      isLifetime: false,
      trialUsed: !!subscription?.trialUsed,
    };
  }

  return {
    tier: "pro",
    plan: subscription?.plan || "monthly",
    status: "active",
    startedAt: subscription?.startedAt || now,
    expiresAt: subscription?.isLifetime ? null : subscription?.expiresAt || null,
    isLifetime: !!subscription?.isLifetime || subscription?.plan === "lifetime",
    trialUsed: !!subscription?.trialUsed,
  };
}
