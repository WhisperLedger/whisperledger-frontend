import { ColorValue, Platform, ViewStyle } from "react-native";

type AppColors = {
  text: string;
  background: string;
  foreground: string;
  card: string;
  primary: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  border: string;
  success: string;
  warning: string;
};

export function isDarkPalette(colors: Pick<AppColors, "text">) {
  return colors.text.toLowerCase() === "#f8fafc";
}

export function appGradients(colors: AppColors) {
  const dark = isDarkPalette(colors);
  return {
    page: dark
      ? (["#080A10", "#0E111F"] as const)
      : (["#F8FAFC", "#F0F7FF"] as const),
    hero: dark
      ? (["#0B1224", "#0E1830", "#080A10"] as const)
      : (["#F0F7FF", "#E0EEFF", "#FFFFFF"] as const),
    primary: dark
      ? (["#3882FF", "#2563EB"] as const)
      : (["#0066FF", "#0052CC"] as const),
    action: dark
      ? (["#3882FF", "#1D4ED8"] as const)
      : (["#0066FF", "#0052CC"] as const),
    subtle: dark
      ? (["#161B30", "#0E111F"] as const)
      : (["#FFFFFF", "#F8FAFC"] as const),
  };
}

export function surfaceStyle(colors: AppColors, elevated = true): ViewStyle {
  const dark = isDarkPalette(colors);
  return {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: elevated ? 8 : 2 },
    shadowOpacity: dark ? 0.22 : elevated ? 0.07 : 0.03,
    shadowRadius: elevated ? 18 : 8,
    elevation: elevated ? 4 : 1,
  };
}

export function iconSurface(colors: AppColors, tone: "primary" | "success" | "warning" | "danger" = "primary"): ViewStyle {
  const dark = isDarkPalette(colors);
  const bgByTone: Record<typeof tone, ColorValue> = {
    primary: dark ? "rgba(56, 130, 255, 0.15)" : "rgba(0, 102, 255, 0.08)",
    success: dark ? "rgba(16, 185, 129, 0.15)" : "rgba(16, 185, 129, 0.08)",
    warning: dark ? "rgba(245, 158, 11, 0.15)" : "rgba(245, 158, 11, 0.08)",
    danger: dark ? "rgba(248, 113, 113, 0.14)" : "#FEE2E2",
  };
  return {
    backgroundColor: bgByTone[tone],
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  };
}

export function bottomInset(extraBottom: number) {
  return Platform.OS === "web" ? 34 + 84 : extraBottom + 84;
}
