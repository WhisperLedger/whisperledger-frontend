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
  return colors.text.toLowerCase() === "#f8faf7" || colors.text.toLowerCase() === "#f8fafc";
}

export function appGradients(colors: AppColors) {
  const dark = isDarkPalette(colors);
  return {
    page: dark
      ? (["#080D0C", "#0F1B18"] as const)
      : (["#F7F4EF", "#EFE8DD"] as const),
    hero: dark
      ? (["#0B1513", "#11312D", "#0B1110"] as const)
      : (["#E8F3EF", "#F7F4EF", "#FFF4D9"] as const),
    primary: dark
      ? (["#14B8A6", "#0F766E"] as const)
      : (["#0F766E", "#115E59"] as const),
    action: dark
      ? (["#F59E0B", "#EA580C"] as const)
      : (["#F59E0B", "#F97316"] as const),
    subtle: dark
      ? (["rgba(45, 212, 191, 0.18)", "rgba(245, 158, 11, 0.08)"] as const)
      : (["#FFFFFF", "#F3EEE5"] as const),
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
    primary: dark ? "rgba(45, 212, 191, 0.15)" : "#DDF7F0",
    success: dark ? "rgba(94, 234, 212, 0.14)" : "#CCFBF1",
    warning: dark ? "rgba(251, 191, 36, 0.14)" : "#FFF4D9",
    danger: dark ? "rgba(248, 113, 113, 0.14)" : "#FEE2E2",
  };
  return {
    backgroundColor: bgByTone[tone],
    borderWidth: dark ? 1 : 0,
    borderColor: colors.border,
  };
}

export function bottomInset(extraBottom: number) {
  return Platform.OS === "web" ? 34 + 84 : extraBottom + 84;
}
