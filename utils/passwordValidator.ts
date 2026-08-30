export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: "weak" | "medium" | "strong";
}

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("At least 8 characters long");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("At least 1 uppercase letter (A-Z)");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("At least 1 lowercase letter (a-z)");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("At least 1 number (0-9)");
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push("At least 1 special character (e.g. @, #, $, !)");
  }

  let strength: "weak" | "medium" | "strong" = "weak";
  if (errors.length === 0) {
    strength = password.length >= 12 ? "strong" : "medium";
  } else if (errors.length <= 2 && password.length >= 6) {
    strength = "weak";
  }

  return {
    isValid: errors.length === 0,
    errors,
    strength,
  };
}
