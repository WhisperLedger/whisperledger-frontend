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

const DAY_MS = 24 * 60 * 60 * 1000;
export const APP_TRIAL_DAYS = 7;

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

export function isUpgradeablePlan(plan: unknown): plan is "monthly" | "yearly" {
  return plan === "monthly" || plan === "yearly";
}

export function createAppTrialSubscription(now = Date.now()): UserSubscription {
  return {
    tier: "pro",
    plan: "trial",
    status: "active",
    startedAt: now,
    expiresAt: now + APP_TRIAL_DAYS * DAY_MS,
    isLifetime: false,
    trialUsed: true,
  };
}

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

export function extractExpiryMs(expiresAt: unknown): number | null {
  if (expiresAt === null || expiresAt === undefined || expiresAt === "") return null;
  if (typeof expiresAt === "number") return Number.isFinite(expiresAt) ? expiresAt : null;
  if (typeof (expiresAt as any)?.toMillis === "function") return (expiresAt as any).toMillis();
  if (typeof (expiresAt as any)?.seconds === "number") return (expiresAt as any).seconds * 1000;
  if (typeof (expiresAt as any)?.toDate === "function") return (expiresAt as any).toDate().getTime();
  if (expiresAt instanceof Date) return expiresAt.getTime();
  if (typeof expiresAt === "string") {
    const num = Number(expiresAt);
    if (Number.isFinite(num) && num > 0) return num;
    const parsed = new Date(expiresAt).getTime();
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function hasActiveProAccess(subscription?: Partial<UserSubscription>, now = Date.now()): boolean {
  if (!subscription) return false;
  const isProTier = subscription.tier === "pro" || (subscription as any).isPro === true;
  if (!isProTier) return false;
  if (subscription.isLifetime || subscription.plan === "lifetime") return true;
  if (subscription.status && subscription.status !== "active") return false;

  const expiryMs = extractExpiryMs(subscription.expiresAt);
  if (expiryMs === null) return true;
  return now <= expiryMs;
}

export function resolveEffectiveSubscription(
  remoteSubscription?: Partial<UserSubscription>,
  fallbackSubscription?: Partial<UserSubscription> | null,
  now = Date.now()
): UserSubscription {
  const remote = resolveUserSubscription(remoteSubscription, now);
  if (hasActiveProAccess(remote, now)) return remote;

  if (!remoteSubscription && hasActiveProAccess(fallbackSubscription || undefined, now)) {
    return resolveUserSubscription(fallbackSubscription || undefined, now);
  }

  return remote;
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
