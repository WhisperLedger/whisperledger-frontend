import { getMerchantMeta } from "../utils/merchantLogos";

describe("Merchant Logos Mapping Suite", () => {
  it("should return official brand colors & badges for popular merchants", () => {
    const swiggy = getMerchantMeta("Swiggy");
    expect(swiggy.brandColor).toBe("#FC8019");
    expect(swiggy.shortBadge).toBe("🍔");

    const zomato = getMerchantMeta("Zomato Cancelled Order");
    expect(zomato.brandColor).toBe("#CB202D");

    const zepto = getMerchantMeta("Zepto Quick Grocery");
    expect(zepto.brandColor).toBe("#7E22CE");
    expect(zepto.shortBadge).toBe("⚡");

    const amazon = getMerchantMeta("Amazon India Return");
    expect(amazon.brandColor).toBe("#232F3E");

    const makeMyTrip = getMerchantMeta("MakeMyTrip Flight");
    expect(makeMyTrip.brandColor).toBe("#EB2026");
  });

  it("should generate a fallback brand badge for unlisted merchants", () => {
    const customMerchant = getMerchantMeta("Local General Store");
    expect(customMerchant.name).toBe("Local General Store");
    expect(customMerchant.shortBadge).toBe("L");
    expect(customMerchant.brandColor).toMatch(/^hsl\(\d+, 65%, 45%\)$/);
  });
});
