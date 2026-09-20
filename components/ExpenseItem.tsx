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

import { useAuth } from "@/context/AuthContext";
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
  const { user } = useAuth();
  const { deleteExpense } = useExpenses();
  const cat = CATEGORIES.find((c) => c.id === expense.categoryId) || CATEGORIES.find((c) => c.id === "other")!;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isDark = isDarkPalette(colors);
  const isHouseholdShare = !!expense.isHouseholdSplitShare;
  const isCreator = !expense.householdCreatedBy || expense.householdCreatedBy === user?.uid;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
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
    if (isHouseholdShare && !isCreator) {
      Alert.alert(
        "Household Split",
        "This is a shared household split. It can be modified or removed in Household Space."
      );
      return;
    }

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
    return "";
  };

  const merchantName = getResolvedMerchantName();
  const displayTitle = expense.note || merchantName || cat.label;
  const paymentMode = (expense.paymentMode && expense.paymentMode !== "none") ? expense.paymentMode.toUpperCase() : null;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <View
        style={[styles.container, surfaceStyle(colors, false)]}
        onTouchStart={handlePressIn}
        onTouchEnd={handlePressOut}
        onTouchCancel={handlePressOut}
      >
        {/* Category Icon / Merchant Logo */}
        <View style={styles.iconContainer}>
          {merchantName ? (
            <MerchantLogo merchant={merchantName} size={40} borderRadius={12} />
          ) : (
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: isDark ? `${cat.color}22` : `${cat.color}15` },
              ]}
            >
              <Feather name={cat.icon as any} size={18} color={cat.color} />
            </View>
          )}

          {paymentMode && (
            <View
              style={[
                styles.miniPaymentPill,
                {
                  backgroundColor: paymentMode === "UPI" ? "#0EA5E9" : paymentMode === "CARD" ? "#F97316" : paymentMode === "CASH" ? "#10B981" : colors.primary,
                },
              ]}
            >
              <Text style={styles.miniPaymentText}>{paymentMode}</Text>
            </View>
          )}
        </View>

        {/* Info Column */}
        <View style={styles.infoCol}>
          <Text style={[styles.titleText, { color: colors.foreground }]} numberOfLines={1}>
            {displayTitle}
          </Text>
          <View style={styles.subtitleRow}>
            <Text style={[styles.subText, { color: colors.mutedForeground }]} numberOfLines={1}>
              {cat.label}
              {expense.location ? ` · 📍 ${expense.location}` : ""}
              {expense.date ? ` · ${expense.date}` : ""}
            </Text>
            {isHouseholdShare && (
              <View
                style={[
                  styles.splitBadge,
                  { backgroundColor: isDark ? "rgba(56, 130, 255, 0.15)" : "#EFF6FF" },
                ]}
              >
                <Feather name="home" size={9} color={colors.primary} />
                <Text style={[styles.splitBadgeText, { color: colors.primary }]}>Split</Text>
              </View>
            )}
          </View>
        </View>

        {/* Right Amount & Actions Column */}
        <View style={styles.rightCol}>
          <Text style={[styles.amountText, { color: colors.foreground }]}>
            ₹{Number(expense.amount || 0).toLocaleString("en-IN")}
          </Text>

          <View style={styles.actionsRow}>
            {onEdit && (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => {
                  safeHaptics.selectionAsync();
                  onEdit(expense);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <Feather name="edit-2" size={12} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handleDelete}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <Feather name="trash-2" size={12} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
    gap: 12,
  },
  iconContainer: {
    position: "relative",
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  miniPaymentPill: {
    position: "absolute",
    bottom: -3,
    right: -3,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  miniPaymentText: {
    color: "#FFFFFF",
    fontSize: 7,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.2,
  },
  infoCol: {
    flex: 1,
    gap: 3,
  },
  titleText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  subtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  subText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  splitBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  splitBadgeText: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
  },
  rightCol: {
    alignItems: "flex-end",
    gap: 4,
  },
  amountText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  actionBtn: {
    padding: 2,
  },
});
