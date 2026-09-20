import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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
import { CATEGORIES } from "@/context/ExpenseContext";
import { useHousehold } from "@/context/HouseholdContext";
import { useColors } from "@/hooks/useColors";
import { HouseholdExpense } from "@/types/household";
import { isDarkPalette, surfaceStyle } from "@/utils/designSystem";
import { safeHaptics } from "@/utils/haptics";

interface Props {
  expense: HouseholdExpense;
  onEdit?: (expense: HouseholdExpense) => void;
}

export default function HouseholdExpenseItem({ expense, onEdit }: Props) {
  const colors = useColors();
  const isDark = isDarkPalette(colors);
  const { user } = useAuth();
  const { deleteHouseholdExpense } = useHousehold();

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isCreator = expense.createdBy === user?.uid;
  const cat =
    CATEGORIES.find((c) => c.id === expense.categoryId) ||
    CATEGORIES.find((c) => c.id === "other")!;

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
    if (!isCreator) {
      Alert.alert(
        "Permission Denied",
        `Only ${expense.createdByName || "the creator"} can delete this expense.`
      );
      return;
    }

    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      "Delete Household Spend",
      "Remove this expense from the household ledger?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            deleteHouseholdExpense(expense.id);
          },
        },
      ]
    );
  };

  // Settlement Item
  if (expense.isSettlement) {
    const isPayer = expense.payerUid === user?.uid;
    const recipientName = expense.settlementDetails?.recipientName || "Flatmate";

    return (
      <View
        style={[
          styles.settlementContainer,
          {
            backgroundColor: isDark ? "rgba(16, 185, 129, 0.08)" : "#F0FDF4",
            borderColor: isDark ? "rgba(16, 185, 129, 0.2)" : "#BBF7D0",
          },
        ]}
      >
        <View style={styles.settlementIconWrap}>
          <Feather name="check" size={14} color="#10B981" />
        </View>

        <View style={{ flex: 1, gap: 1 }}>
          <Text style={[styles.settlementTitle, { color: colors.foreground }]} numberOfLines={1}>
            {isPayer
              ? `You settled with ${recipientName}`
              : `${expense.payerName} settled with ${expense.settlementDetails?.recipientUid === user?.uid ? "You" : recipientName}`}
          </Text>
          <Text style={[styles.settlementSub, { color: colors.mutedForeground }]}>
            Settlement • {expense.date}
          </Text>
        </View>

        <Text style={[styles.settlementAmount, { color: "#10B981" }]}>
          ₹{Number(expense.amount || 0).toFixed(0)}
        </Text>
      </View>
    );
  }

  const userSplit = Array.isArray(expense.splits)
    ? expense.splits.find((s) => s.uid === user?.uid)
    : null;
  const isPayer = expense.payerUid === user?.uid;
  const yourShare = userSplit ? Number(userSplit.share || 0) : 0;
  const lentAmount = isPayer ? Number(expense.amount || 0) - yourShare : 0;
  const borrowedAmount = !isPayer && userSplit ? yourShare : 0;

  // Standard Expense Item
  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <View
        style={[styles.container, surfaceStyle(colors, false)]}
        onTouchStart={handlePressIn}
        onTouchEnd={handlePressOut}
        onTouchCancel={handlePressOut}
      >
        {/* Category Icon */}
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: isDark ? `${cat.color}22` : `${cat.color}15` },
          ]}
        >
          <Feather name={cat.icon as any} size={18} color={cat.color} />
        </View>

        {/* Content Info */}
        <View style={styles.infoCol}>
          <Text style={[styles.noteText, { color: colors.foreground }]} numberOfLines={1}>
            {expense.note || cat.label}
          </Text>
          <Text style={[styles.subText, { color: colors.mutedForeground }]} numberOfLines={1}>
            {isPayer ? "You paid" : `${expense.payerName || "Flatmate"} paid`} ₹{Number(expense.amount || 0).toFixed(0)}
            {userSplit ? ` · Your share: ₹${yourShare.toFixed(0)}` : ""}
          </Text>
        </View>

        {/* Right Info */}
        <View style={styles.rightCol}>
          {isPayer && lentAmount > 0 ? (
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[styles.netAmount, { color: "#10B981" }]}>
                +₹{lentAmount.toFixed(0)}
              </Text>
              <Text style={styles.netLabelLent}>you lent</Text>
            </View>
          ) : borrowedAmount > 0 ? (
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[styles.netAmount, { color: "#EF4444" }]}>
                -₹{borrowedAmount.toFixed(0)}
              </Text>
              <Text style={styles.netLabelOwe}>you owe</Text>
            </View>
          ) : (
            <Text style={[styles.netAmount, { color: colors.foreground }]}>
              ₹{Number(expense.amount || 0).toFixed(0)}
            </Text>
          )}

          {isCreator && (
            <View style={styles.actionsRow}>
              {onEdit && (
                <TouchableOpacity
                  style={styles.actionIconBtn}
                  onPress={() => onEdit(expense)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="edit-2" size={12} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.actionIconBtn}
                onPress={handleDelete}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="trash-2" size={12} color="#EF4444" />
              </TouchableOpacity>
            </View>
          )}
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
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  infoCol: {
    flex: 1,
    gap: 3,
  },
  noteText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  subText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  rightCol: {
    alignItems: "flex-end",
    gap: 4,
  },
  netAmount: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  netLabelLent: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "#10B981",
  },
  netLabelOwe: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "#EF4444",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  actionIconBtn: {
    padding: 2,
  },
  settlementContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    gap: 10,
  },
  settlementIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  settlementTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  settlementSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  settlementAmount: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
});
