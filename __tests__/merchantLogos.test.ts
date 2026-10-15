import { getMerchantMeta } from "../utils/merchantLogos";

describe("merchant identity resolver", () => {
  it("resolves common merchant aliases to their public-domain icon", () => {
    const swiggy = getMerchantMeta("Swiggy");
    expect(swiggy.brandColor).toBe("#FC8019");
    expect(swiggy.isKnownMerchant).toBe(true);
    expect(swiggy.logoUrl).toContain("swiggy.com");

    const zomato = getMerchantMeta("Zomato Cancelled Order");
    expect(zomato.brandColor).toBe("#E23744");

    const zepto = getMerchantMeta("Zepto Quick Grocery");
    expect(zepto.brandColor).toBe("#3B1464");
    expect(zepto.logoUrl).toContain("zeptonow.com");

    const amazon = getMerchantMeta("Amazon India Return");
    expect(amazon.brandColor).toBe("#232F3E");

    const makeMyTrip = getMerchantMeta("MakeMyTrip Flight");
    expect(makeMyTrip.brandColor).toBe("#EB2026");
  });

  it("uses stable initials rather than an invented icon for unlisted merchants", () => {
    const customMerchant = getMerchantMeta("Local General Store");
    expect(customMerchant.name).toBe("Local General Store");
    expect(customMerchant.initials).toBe("LG");
    expect(customMerchant.isKnownMerchant).toBe(false);
    expect(customMerchant.logoUrl).toBeUndefined();
    expect(customMerchant.brandColor).toMatch(/^#[0-9A-F]{6}$/);
  });
});
