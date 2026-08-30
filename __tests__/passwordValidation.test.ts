import { validatePassword } from "../utils/passwordValidator";

describe("Password Validator", () => {
  it("should fail for short passwords (< 8 characters)", () => {
    const res = validatePassword("Short1!");
    expect(res.isValid).toBe(false);
    expect(res.errors).toContain("At least 8 characters long");
  });

  it("should fail if missing uppercase letter", () => {
    const res = validatePassword("lowercase1!");
    expect(res.isValid).toBe(false);
    expect(res.errors).toContain("At least 1 uppercase letter (A-Z)");
  });

  it("should fail if missing lowercase letter", () => {
    const res = validatePassword("UPPERCASE1!");
    expect(res.isValid).toBe(false);
    expect(res.errors).toContain("At least 1 lowercase letter (a-z)");
  });

  it("should fail if missing number", () => {
    const res = validatePassword("NoNumber!");
    expect(res.isValid).toBe(false);
    expect(res.errors).toContain("At least 1 number (0-9)");
  });

  it("should fail if missing special character", () => {
    const res = validatePassword("NoSpecial1");
    expect(res.isValid).toBe(false);
    expect(res.errors).toContain("At least 1 special character (e.g. @, #, $, !)");
  });

  it("should pass for strong valid passwords", () => {
    const res = validatePassword("SecureP@ssw0rd2026!");
    expect(res.isValid).toBe(true);
    expect(res.errors.length).toBe(0);
    expect(res.strength).toBe("strong");
  });
});
