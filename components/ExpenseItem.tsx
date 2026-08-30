import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { safeHaptics } from "@/utils/haptics";
import React, { useRef } from "react";
import {
  Alert,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { CATEGORIES, Expense, useExpenses } from "@/context/ExpenseContext";
import { useColors } from "@/hooks/useColors";
import MerchantLogo from "@/components/MerchantLogo";
import { isDarkPalette, surfaceStyle } from "@/utils/designSystem";

interface Props {
  expense: Expense;
  onEdit?: (expense: Expense) => void;
}

export default function ExpenseItem({ expense, onEdit }: Props) {
  const colors = useColors();
  const { deleteExpense } = useExpenses();
  const cat = CATEGORIES.find((c) => c.id === expense.categoryId) || CATEGORIES.find((c) => c.id === "other")!;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isDark = isDarkPalette(colors);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
    }).start();
  };

  const handleDelete = () => {
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert("Delete Expense", "Remove this expense permanently?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          deleteExpense(expense.id);
        },
      },
    ]);
  };

  const styles = StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      padding: 14,
      marginBottom: 8,
      gap: 12,
      ...surfaceStyle(colors, false),
    },
    iconWrap: {
      width: 46,
      height: 46,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isDark ? `${cat.color}22` : `${cat.color}15`,
    },
    info: {
      flex: 1,
    },
    catLabel: {
      fontSize: 14,
      fontWeight: "600" as const,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    note: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      marginTop: 2,
    },
    right: {
      alignItems: "flex-end",
      gap: 6,
    },
    amount: {
      fontSize: 16,
      fontWeight: "700" as const,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    actions: {
      flexDirection: "row",
      gap: 6,
    },
    editBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: isDark ? "rgba(56, 130, 255, 0.12)" : "#F0F7FF",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
    },
    editBtnText: {
      fontSize: 11,
      fontFamily: "Inter_600SemiBold",
      fontWeight: "600" as const,
      color: colors.primary,
    },
    deleteBtn: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: isDark ? "rgba(239, 68, 68, 0.15)" : "#fef2f2",
      alignItems: "center",
      justifyContent: "center",
    },
  });

  const renderPaymentModeBadge = () => {
    if (!expense.paymentMode || expense.paymentMode === "none") return null;

    let icon: any = "credit-card";
    let bg = isDark ? "rgba(56, 130, 255, 0.15)" : "rgba(0, 102, 255, 0.08)";
    let fg = colors.primary;
    let label = expense.paymentMode.toUpperCase();

    if (expense.paymentMode === "upi") {
      icon = "zap";
      bg = isDark ? "rgba(14, 165, 233, 0.15)" : "rgba(14, 165, 233, 0.12)";
      fg = isDark ? "#38BDF8" : "#0369A1";
      label = "UPI";
    } else if (expense.paymentMode === "card") {
      icon = "credit-card";
      bg = isDark ? "rgba(249, 115, 22, 0.15)" : "rgba(249, 115, 22, 0.12)";
      fg = isDark ? "#FB923C" : "#C2410C";
      label = "CARD";
    } else if (expense.paymentMode === "cash") {
      icon = "dollar-sign";
      bg = isDark ? "rgba(16, 185, 129, 0.15)" : "rgba(16, 185, 129, 0.12)";
      fg = isDark ? "#34D399" : "#047857";
      label = "CASH";
    } else if (expense.paymentMode === "netbanking") {
      icon = "briefcase";
      bg = isDark ? "rgba(56, 130, 255, 0.15)" : "rgba(0, 102, 255, 0.10)";
      fg = isDark ? "#93C5FD" : "#0066FF";
      label = "BANK";
    }

    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: bg,
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 6,
          gap: 4,
          borderWidth: 0.5,
          borderColor: `${fg}30`,
        }}
      >
        <Feather name={icon} size={9} color={fg} />
        <Text style={{ fontSize: 9, fontFamily: "Inter_700Bold", color: fg, letterSpacing: 0.5 }}>
          {label}
        </Text>
      </View>
    );
  };

  const getResolvedMerchantName = (): string => {
    if (expense.merchant && expense.merchant.trim().length > 0) {
      return expense.merchant.trim();
    }
    const noteText = (expense.note || "").toLowerCase();
    const knownBrands = [
      "swiggy", "zepto", "zomato", "blinkit", "amazon", "flipkart",
      "uber", "ola", "paytm", "phonepe", "gpay", "google pay", "starbucks",
      "netflix", "spotify", "cred", "myntra", "bigbasket", "dunzo", "jio",
      "airtel", "makemytrip", "mmt", "bookmyshow", "urban company"
    ];
    for (const b of knownBrands) {
      if (noteText.includes(b)) {
        return b;
      }
    }
    return expense.note || "";
  };

  const merchantName = getResolvedMerchantName();

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
      {merchantName ? (
        <MerchantLogo merchant={merchantName} size={46} borderRadius={14} />
      ) : (
        <View style={styles.iconWrap}>
          <Feather name={cat.icon as any} size={22} color={cat.color} />
        </View>
      )}

      <View style={styles.info}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={styles.catLabel}>{cat.label}</Text>
          {renderPaymentModeBadge()}
        </View>
        {!!expense.note && <Text style={styles.note}>{expense.note}</Text>}
      </View>

      <View style={styles.right}>
        <Text style={styles.amount}>₹{Number(expense.amount || 0).toLocaleString("en-IN")}</Text>
        <View style={styles.actions}>
          {onEdit && (
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => { safeHaptics.selectionAsync(); onEdit(expense); }}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              activeOpacity={0.8}
            >
              <Feather name="edit-2" size={11} color={colors.primary} />
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={handleDelete}
            activeOpacity={0.75}
          >
            <Feather name="trash-2" size={13} color={colors.text === "#f8fafc" ? "#f87171" : "#ef4444"} />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}
