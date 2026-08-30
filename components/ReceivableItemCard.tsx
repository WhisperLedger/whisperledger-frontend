import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import type { Receivable } from "@/types/receivable";
import { CATEGORY_LABELS } from "@/types/receivable";
import { getReceivableStatusMeta, calculateDaysOverdue } from "@/utils/recoveryEngine";
import { safeHaptics } from "@/utils/haptics";
import MerchantLogo from "@/components/MerchantLogo";

interface ReceivableItemCardProps {
  receivable: Receivable;
  onPress: (item: Receivable) => void;
  onStartRecovery?: (item: Receivable) => void;
}

export default function ReceivableItemCard({ receivable, onPress, onStartRecovery }: ReceivableItemCardProps) {
  const colors = useColors();
  const meta = getReceivableStatusMeta(receivable.status, receivable.expectedRefundDate);
  const cat = CATEGORY_LABELS[receivable.category] || CATEGORY_LABELS.other;
  const daysOverdue = calculateDaysOverdue(receivable.expectedRefundDate);

  const formattedDate = new Date(receivable.expectedRefundDate).toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
  });

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => {
        safeHaptics.selectionAsync();
        onPress(receivable);
      }}
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: meta.isOverdue ? "rgba(239, 68, 68, 0.4)" : colors.border,
        },
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.merchantSection}>
          <MerchantLogo merchant={receivable.merchant} size={44} borderRadius={13} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={[styles.merchantName, { color: colors.foreground }]} numberOfLines={1}>
              {receivable.merchant}
            </Text>
            <Text style={[styles.categoryText, { color: colors.mutedForeground }]}>
              {cat.label} {receivable.orderId ? `• #${receivable.orderId}` : ""}
            </Text>
          </View>
        </View>

        <View style={{ alignItems: "flex-end" }}>
          <Text style={[styles.amountText, { color: colors.foreground }]}>
            ₹{receivable.amount.toLocaleString("en-IN")}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: meta.badgeColor }]}>
            <Text style={[styles.statusText, { color: meta.textColor }]}>{meta.label}</Text>
          </View>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.bottomRow}>
        <View style={styles.timingInfo}>
          <Feather name="calendar" size={14} color={meta.isOverdue ? "#ef4444" : colors.mutedForeground} />
          <Text style={[styles.timingText, { color: meta.isOverdue ? "#ef4444" : colors.mutedForeground }]}>
            {meta.isOverdue
              ? `Expected: ${formattedDate} (${daysOverdue} day${daysOverdue > 1 ? "s" : ""} overdue)`
              : `Expected by: ${formattedDate}`}
          </Text>
        </View>

        {meta.isOverdue && receivable.status !== "RECOVERED" && (
          <TouchableOpacity
            style={styles.recoveryBtn}
            activeOpacity={0.8}
            onPress={() => {
              safeHaptics.impactAsync();
              onStartRecovery ? onStartRecovery(receivable) : onPress(receivable);
            }}
          >
            <Feather name="shield" size={13} color="#fff" style={{ marginRight: 4 }} />
            <Text style={styles.recoveryBtnText}>Start Recovery</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  merchantSection: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  merchantName: {
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  categoryText: {
    fontSize: 12,
    marginTop: 2,
    fontFamily: "Inter_400Regular",
  },
  amountText: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(148, 163, 184, 0.15)",
    marginVertical: 12,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timingInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  timingText: {
    fontSize: 12,
    marginLeft: 6,
    fontFamily: "Inter_500Medium",
  },
  recoveryBtn: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  recoveryBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
});
