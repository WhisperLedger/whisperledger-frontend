import {
  validateEmail,
  validateFullName,
  validateUsername,
  validateAmount,
  validateMerchantName,
} from "../utils/validation";

describe("Validation Utility Suite", () => {
  describe("validateEmail", () => {
    it("should accept valid email addresses (Happy Path)", () => {
      expect(validateEmail("user@gmail.com").isValid).toBe(true);
      expect(validateEmail("  test.name+alias@domain.co.in ").isValid).toBe(true);
    });

    it("should reject invalid email formats (Unhappy Path)", () => {
      expect(validateEmail("").isValid).toBe(false);
      expect(validateEmail("   ").isValid).toBe(false);
      expect(validateEmail("user@").isValid).toBe(false);
      expect(validateEmail("user@com").isValid).toBe(false);
      expect(validateEmail("plainaddress").isValid).toBe(false);
      expect(validateEmail(".user@gmail.com").isValid).toBe(false);
      expect(validateEmail("user..name@gmail.com").isValid).toBe(false);
      expect(validateEmail("user@example.com").isValid).toBe(false);
      expect(validateEmail("user@mailinator.com").isValid).toBe(false);
    });
  });

  describe("validateFullName", () => {
    it("should accept valid names (Happy Path)", () => {
      expect(validateFullName("Tanmay Agarwal").isValid).toBe(true);
      expect(validateFullName("Anne-Marie O'Neill").isValid).toBe(true);
    });

    it("should reject invalid names (Unhappy Path)", () => {
      expect(validateFullName("").isValid).toBe(false);
      expect(validateFullName("A").isValid).toBe(false);
      expect(validateFullName("Tanmay123").isValid).toBe(false);
      expect(validateFullName("X".repeat(70)).isValid).toBe(false);
    });
  });

  describe("validateUsername", () => {
    it("should accept valid usernames (Happy Path)", () => {
      expect(validateUsername("john_doe").isValid).toBe(true);
      expect(validateUsername("tanmay16").isValid).toBe(true);
    });

    it("should reject invalid usernames (Unhappy Path)", () => {
      expect(validateUsername("ab").isValid).toBe(false); // too short
      expect(validateUsername("a".repeat(25)).isValid).toBe(false); // too long
      expect(validateUsername("user@name").isValid).toBe(false); // special char
      expect(validateUsername("user name").isValid).toBe(false); // space
    });
  });

  describe("validateAmount", () => {
    it("should accept positive non-zero amounts (Happy Path)", () => {
      expect(validateAmount(150).isValid).toBe(true);
      expect(validateAmount("8499.50").isValid).toBe(true);
      expect(validateAmount("1,500").isValid).toBe(true);
    });

    it("should reject zero, negative, or invalid amounts (Unhappy Path)", () => {
      expect(validateAmount(0).isValid).toBe(false);
      expect(validateAmount(-50).isValid).toBe(false);
      expect(validateAmount("abc").isValid).toBe(false);
      expect(validateAmount("").isValid).toBe(false);
      expect(validateAmount(999_999_999).isValid).toBe(false); // exceeds limit
    });
  });

  describe("validateMerchantName", () => {
    it("should accept valid merchant names (Happy Path)", () => {
      expect(validateMerchantName("Amazon India").isValid).toBe(true);
      expect(validateMerchantName("Swiggy").isValid).toBe(true);
    });

    it("should reject empty or invalid merchant names (Unhappy Path)", () => {
      expect(validateMerchantName("").isValid).toBe(false);
      expect(validateMerchantName("   ").isValid).toBe(false);
      expect(validateMerchantName("A").isValid).toBe(false);
      expect(validateMerchantName("X".repeat(70)).isValid).toBe(false);
    });
  });
});
