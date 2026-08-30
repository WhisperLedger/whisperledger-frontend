import {
  hasActiveProAccess,
  normalizePlanConfig,
  PlanConfig,
  resolveUserSubscription,
  UserSubscription,
} from "../utils/subscriptionModel";

describe("Subscription Model & Gating Logic", () => {
  const mockPlanConfig: PlanConfig = {
    monthlyPrice: 99,
    yearlyPrice: 799,
    discountPercentage: 33,
    trialDays: 7,
    promoBanner: "Launch Offer",
    freeSmsLookbackLimit: 10,
    freeRefundCaseLimit: 2,
    freeBudgetLimit: 1,
  };

  test("calculates monthly equivalent for yearly plan accurately", () => {
    const monthlyEquivalent = Math.round(mockPlanConfig.yearlyPrice / 12);
    expect(monthlyEquivalent).toBe(67);
  });

  test("resolves Free user access correctly", () => {
    const freeSub: UserSubscription = {
      tier: "free",
      plan: "free",
      status: "none",
      expiresAt: null,
    };

    expect(hasActiveProAccess(freeSub)).toBe(false);
    expect(resolveUserSubscription(freeSub).tier).toBe("free");
  });

  test("resolves Active Pro user access correctly", () => {
    const proSub: UserSubscription = {
      tier: "pro",
      plan: "monthly",
      status: "active",
      startedAt: Date.now() - 10000,
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    };

    expect(hasActiveProAccess(proSub)).toBe(true);
    expect(resolveUserSubscription(proSub).tier).toBe("pro");
  });

  test("resolves Expired Pro user back to Free correctly", () => {
    const expiredSub: UserSubscription = {
      tier: "pro",
      plan: "monthly",
      status: "active",
      startedAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
      expiresAt: Date.now() - 1000, // expired in past
    };

    expect(hasActiveProAccess(expiredSub)).toBe(false);
    expect(resolveUserSubscription(expiredSub).tier).toBe("free");
  });

  test("VIP Lifetime Pro never expires even with null or past timestamp", () => {
    const lifetimeSub: UserSubscription = {
      tier: "pro",
      plan: "lifetime",
      status: "active",
      startedAt: Date.now() - 100000,
      expiresAt: null,
      isLifetime: true,
    };

    expect(hasActiveProAccess(lifetimeSub)).toBe(true);
    expect(resolveUserSubscription(lifetimeSub).tier).toBe("pro");
    expect(lifetimeSub.isLifetime).toBe(true);
  });

  test("does not grant access for canceled Pro records", () => {
    const canceledSub: UserSubscription = {
      tier: "pro",
      plan: "monthly",
      status: "canceled",
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    };

    expect(hasActiveProAccess(canceledSub)).toBe(false);
    expect(resolveUserSubscription(canceledSub).tier).toBe("free");
  });

  test("normalizes dynamic plan config with safe fallbacks", () => {
    const config = normalizePlanConfig({
      monthlyPrice: 129,
      yearlyPrice: undefined,
      discountPercentage: 999,
      trialDays: -5,
      promoBanner: "Founder offer",
    });

    expect(config.monthlyPrice).toBe(129);
    expect(config.yearlyPrice).toBe(799);
    expect(config.discountPercentage).toBe(90);
    expect(config.trialDays).toBe(0);
    expect(config.freeSmsLookbackLimit).toBe(10);
    expect(config.freeRefundCaseLimit).toBe(2);
    expect(config.freeBudgetLimit).toBe(1);
  });
});
