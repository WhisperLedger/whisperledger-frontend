import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as Haptics from "expo-haptics";

import { useReceivables } from "@/context/ReceivablesContext";
import { useColors } from "@/hooks/useColors";
import { getReceivableStatusMeta } from "@/utils/recoveryEngine";
import { safeHaptics } from "@/utils/haptics";

interface ReceivablesSummaryCardProps {
  onOpenAdd?: () => void;
}

export default function ReceivablesSummaryCard({ onOpenAdd }: ReceivablesSummaryCardProps) {
  const colors = useColors();
  const { getPendingReceivables, getTotalPendingAmount } = useReceivables();

  const pendingItems = getPendingReceivables();
  const totalAmount = getTotalPendingAmount();

  if (pendingItems.length === 0) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={colors.text === "#f8fafc" ? ["#1e1b4b", "#0f172a"] : ["#EEF2FF", "#F8FAFC"]}
          style={[
            styles.card,
            { borderColor: colors.text === "#f8fafc" ? "rgba(99, 102, 241, 0.3)" : "rgba(99, 102, 241, 0.15)" },
          ]}
        >
          <View style={styles.emptyRow}>
            <View style={styles.iconCircle}>
              <Feather name="shield" size={24} color="#6366f1" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.title, { color: colors.foreground }]}>No Pending Refunds</Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                Track e-commerce returns, flight cancellations & reversals automatically
              </Text>
            </View>
            <TouchableOpacity
              style={styles.addBtnSmall}
              onPress={() => {
                safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onOpenAdd?.();
              }}
            >
              <Feather name="plus" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  }

  // Count overdue vs active
  let overdueCount = 0;
  let waitingCount = 0;

  pendingItems.forEach((item) => {
    const meta = getReceivableStatusMeta(item.status, item.expectedRefundDate);
    if (meta.isOverdue) overdueCount++;
    else waitingCount++;
  });

  return (
    <View style={styles.container}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => {
          safeHaptics.selectionAsync();
          router.push("/recovery" as any);
        }}
      >
        <LinearGradient
          colors={
            overdueCount > 0
              ? colors.text === "#f8fafc"
                ? ["#31101b", "#180914"]
                : ["#FEF2F2", "#FFF5F5"]
              : colors.text === "#f8fafc"
              ? ["#102a24", "#0a1815"]
              : ["#ECFDF5", "#F0FDF4"]
          }
          style={[
            styles.card,
            {
              borderColor:
                overdueCount > 0
                  ? colors.text === "#f8fafc"
                    ? "rgba(239, 68, 68, 0.4)"
                    : "rgba(239, 68, 68, 0.25)"
                  : colors.text === "#f8fafc"
                  ? "rgba(16, 185, 129, 0.4)"
                  : "rgba(16, 185, 129, 0.25)",
            },
          ]}
        >
          <View style={styles.topRow}>
            <View style={styles.heroHeader}>
              <Text style={styles.heroBadgeText}>POST-PURCHASE MONEY RECOVERY</Text>
              <Text style={[styles.heroAmount, { color: colors.foreground }]}>
                💰 ₹{totalAmount.toLocaleString("en-IN")}
              </Text>
              <Text style={[styles.heroSubText, { color: colors.mutedForeground }]}>
                {pendingItems.length} pending refund{pendingItems.length > 1 ? "s" : ""} expected back
              </Text>
            </View>

            <View style={styles.arrowCircle}>
              <Feather name="arrow-right" size={20} color={overdueCount > 0 ? "#ef4444" : "#10b981"} />
            </View>
          </View>

          <View style={styles.badgesRow}>
            {overdueCount > 0 && (
              <View style={[styles.pill, { backgroundColor: "rgba(239, 68, 68, 0.15)", borderColor: "#ef4444" }]}>
                <View style={[styles.dot, { backgroundColor: "#ef4444" }]} />
                <Text style={[styles.pillText, { color: "#ef4444" }]}>
                  {overdueCount} Overdue (Action Needed)
                </Text>
              </View>
            )}

            {waitingCount > 0 && (
              <View style={[styles.pill, { backgroundColor: "rgba(16, 185, 129, 0.15)", borderColor: "#10b981" }]}>
                <View style={[styles.dot, { backgroundColor: "#10b981" }]} />
                <Text style={[styles.pillText, { color: "#10b981" }]}>
                  {waitingCount} Expected Soon
                </Text>
              </View>
            )}
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginVertical: 10,
  },
  card: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  emptyRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(99, 102, 241, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
    fontFamily: "Inter_400Regular",
  },
  addBtnSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#6366f1",
    alignItems: "center",
    justifyContent: "center",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroHeader: {
    flex: 1,
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    color: "#6366f1",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  heroAmount: {
    fontSize: 26,
    fontWeight: "800",
    fontFamily: "Inter_700Bold",
  },
  heroSubText: {
    fontSize: 13,
    marginTop: 2,
    fontFamily: "Inter_400Regular",
  },
  arrowCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 14,
    gap: 8,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  pillText: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
});
