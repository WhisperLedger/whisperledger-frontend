/**
 * Centralized Input Validation & Edge-Case Sanitization Suite
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

const BLOCKED_EMAIL_DOMAINS = new Set([
  "example.com",
  "example.org",
  "example.net",
  "test.com",
  "mailinator.com",
  "10minutemail.com",
  "tempmail.com",
  "guerrillamail.com",
]);

export function validateFullName(name: string): ValidationResult {
  const sanitized = (name || "").trim().replace(/\s+/g, " ");

  if (!sanitized) {
    return { isValid: false, error: "Full name is required." };
  }

  if (sanitized.length < 2) {
    return { isValid: false, error: "Full name must be at least 2 characters long." };
  }

  if (sanitized.length > 60) {
    return { isValid: false, error: "Full name cannot exceed 60 characters." };
  }

  if (!/^[a-zA-Z][a-zA-Z\s'.-]*$/.test(sanitized)) {
    return { isValid: false, error: "Full name can only contain letters, spaces, apostrophes, periods, and hyphens." };
  }

  return { isValid: true };
}

/**
 * Validates and sanitizes email address formats.
 */
export function validateEmail(email: string): ValidationResult {
  const sanitized = (email || "").trim().toLowerCase();

  if (!sanitized) {
    return { isValid: false, error: "Email address is required." };
  }

  // RFC 5322 compliant regex check
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(sanitized)) {
    return { isValid: false, error: "Please enter a valid email address (e.g., name@gmail.com)." };
  }

  const [localPart, domain] = sanitized.split("@");
  if (
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    localPart.includes("..") ||
    domain.includes("..") ||
    domain.startsWith("-") ||
    domain.endsWith("-")
  ) {
    return { isValid: false, error: "Please enter a valid email address." };
  }

  const domainParts = domain.split(".");
  if (domainParts.some((part) => !part || part.startsWith("-") || part.endsWith("-"))) {
    return { isValid: false, error: "Please enter a valid email domain." };
  }

  if (BLOCKED_EMAIL_DOMAINS.has(domain)) {
    return { isValid: false, error: "Please use a real personal email address, not a test or temporary email." };
  }

  return { isValid: true };
}

/**
 * Validates username (alphanumeric, underscores, 3-20 chars).
 */
export function validateUsername(username: string): ValidationResult {
  const sanitized = (username || "").trim().toLowerCase();

  if (!sanitized) {
    return { isValid: false, error: "Username is required." };
  }

  if (sanitized.length < 3) {
    return { isValid: false, error: "Username must be at least 3 characters long." };
  }

  if (sanitized.length > 20) {
    return { isValid: false, error: "Username cannot exceed 20 characters." };
  }

  const usernameRegex = /^[a-zA-Z0-9_]+$/;
  if (!usernameRegex.test(sanitized)) {
    return { isValid: false, error: "Username can only contain letters, numbers, and underscores." };
  }

  return { isValid: true };
}

/**
 * Validates financial transaction amounts (positive non-zero numbers).
 */
export function validateAmount(amountVal: string | number): ValidationResult {
  if (amountVal === undefined || amountVal === null || amountVal === "") {
    return { isValid: false, error: "Amount is required." };
  }

  const num = typeof amountVal === "number" ? amountVal : parseFloat(String(amountVal).replace(/,/g, "").trim());

  if (Number.isNaN(num)) {
    return { isValid: false, error: "Please enter a valid numeric amount." };
  }

  if (num <= 0) {
    return { isValid: false, error: "Amount must be greater than ₹0." };
  }

  if (num > 100_000_000) {
    return { isValid: false, error: "Amount exceeds maximum transaction limit (₹10 Crores)." };
  }

  return { isValid: true };
}

/**
 * Validates merchant / company name.
 */
export function validateMerchantName(merchant: string): ValidationResult {
  const sanitized = (merchant || "").trim();

  if (!sanitized) {
    return { isValid: false, error: "Merchant / Company name is required." };
  }

  if (sanitized.length < 2) {
    return { isValid: false, error: "Merchant name must be at least 2 characters long." };
  }

  if (sanitized.length > 60) {
    return { isValid: false, error: "Merchant name is too long (maximum 60 characters)." };
  }

  return { isValid: true };
}
