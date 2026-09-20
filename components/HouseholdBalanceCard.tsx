import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useAuth } from "@/context/AuthContext";
import { useHousehold } from "@/context/HouseholdContext";
import { useColors } from "@/hooks/useColors";
import { DebtSummary } from "@/types/household";
import { isDarkPalette, surfaceStyle } from "@/utils/designSystem";
import { safeHaptics } from "@/utils/haptics";

interface Props {
  onManagePress: () => void;
  onSettleDebt?: (debt?: DebtSummary) => void;
}

export default function HouseholdBalanceCard({ onManagePress, onSettleDebt }: Props) {
  const colors = useColors();
  const isDark = isDarkPalette(colors);
  const { user } = useAuth();
  const { currentHousehold, householdExpenses, balances, pairwiseDebts, userNetBalance } = useHousehold();

  if (!currentHousehold) {
    return (
      <View style={[styles.emptyContainer, surfaceStyle(colors, false)]}>
        <View
          style={[
            styles.emptyIconWrap,
            { backgroundColor: isDark ? "rgba(56, 130, 255, 0.15)" : "rgba(0, 102, 255, 0.08)" },
          ]}
        >
          <Feather name="users" size={26} color={colors.primary} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
          No Household Space Yet
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
          Create a space or enter an invite code to split rent, groceries, and maid/cook expenses.
        </Text>
        <TouchableOpacity
          style={[styles.createBtn, { backgroundColor: colors.primary }]}
          onPress={onManagePress}
          activeOpacity={0.8}
        >
          <Feather name="plus-circle" size={16} color="#FFFFFF" />
          <Text style={styles.createBtnText}>Create or Join Household</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isOwed = userNetBalance > 0.01;
  const owes = userNetBalance < -0.01;
  const isSettled = !isOwed && !owes;

  const membersList = Object.values(currentHousehold.members || {});
  const totalGroupSpend = (householdExpenses || [])
    .filter((e) => !e.isSettlement)
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const handleShareInvite = async () => {
    if (!currentHousehold?.inviteCode) return;
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message: `Join our flat "${currentHousehold.name}" on WhisperLedger! Enter invite code: ${currentHousehold.inviteCode}`,
      });
    } catch {}
  };

  return (
    <View style={[styles.container, surfaceStyle(colors, false)]}>
      {/* Top Header: Flat Name & Actions */}
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <Text style={[styles.householdName, { color: colors.foreground }]} numberOfLines={1}>
            {currentHousehold.name}
          </Text>
          <Text style={[styles.memberCountText, { color: colors.mutedForeground }]}>
            {membersList.length} flatmate{membersList.length === 1 ? "" : "s"} · ₹{totalGroupSpend.toLocaleString("en-IN")} total spend
          </Text>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[
              styles.codeBtn,
              {
                backgroundColor: isDark ? "rgba(56, 130, 255, 0.12)" : "#EFF6FF",
                borderColor: isDark ? "rgba(56, 130, 255, 0.25)" : "rgba(0, 102, 255, 0.15)",
              },
            ]}
            onPress={handleShareInvite}
            activeOpacity={0.7}
          >
            <Feather name="share-2" size={12} color={colors.primary} />
            <Text style={[styles.codeText, { color: colors.primary }]}>
              {currentHousehold.inviteCode}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.settingsBtn,
              { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" },
            ]}
            onPress={onManagePress}
            activeOpacity={0.7}
          >
            <Feather name="settings" size={14} color={colors.foreground} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Hero Net Position Banner (Google Split Style) */}
      <View
        style={[
          styles.heroStatusBox,
          isOwed && {
            backgroundColor: isDark ? "rgba(16, 185, 129, 0.1)" : "#ECFDF5",
            borderColor: isDark ? "rgba(16, 185, 129, 0.25)" : "#A7F3D0",
          },
          owes && {
            backgroundColor: isDark ? "rgba(239, 68, 68, 0.1)" : "#FEF2F2",
            borderColor: isDark ? "rgba(239, 68, 68, 0.25)" : "#FECACA",
          },
          isSettled && {
            backgroundColor: isDark ? "rgba(56, 130, 255, 0.08)" : "#F0F7FF",
            borderColor: isDark ? "rgba(56, 130, 255, 0.2)" : "#BFDBFE",
          },
        ]}
      >
        <View style={styles.heroTextCol}>
          <Text
            style={[
              styles.heroSubtitle,
              { color: isOwed ? "#10B981" : owes ? "#EF4444" : colors.primary },
            ]}
          >
            {isOwed
              ? "You get back in total"
              : owes
              ? "You owe in total"
              : "You are all even"}
          </Text>
          <Text
            style={[
              styles.heroAmount,
              { color: isOwed ? "#10B981" : owes ? "#EF4444" : colors.primary },
            ]}
          >
            {isSettled ? "₹0.00" : `₹${Math.abs(userNetBalance).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </Text>
        </View>

        {!isSettled && onSettleDebt ? (
          <TouchableOpacity
            style={[styles.heroSettleBtn, { backgroundColor: isOwed ? "#10B981" : colors.primary }]}
            onPress={() => {
              safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSettleDebt();
            }}
            activeOpacity={0.8}
          >
            <Feather name="zap" size={13} color="#FFFFFF" />
            <Text style={styles.heroSettleBtnText}>Settle Up</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.heroRightBadge}>
            <Text
              style={[
                styles.heroRightBadgeText,
                { color: isOwed ? "#10B981" : owes ? "#EF4444" : colors.primary },
              ]}
            >
              {isOwed ? "🟢 In Credit" : owes ? "🔴 In Debt" : "⚪ Settled"}
            </Text>
          </View>
        )}
      </View>

      {/* Each Member's Spend & Split Breakdown (Google Split Style) */}
      {membersList.length > 0 && (
        <View style={styles.membersSection}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
            EACH PERSON'S SPEND & SHARE
          </Text>

          <View style={styles.membersList}>
            {membersList.map((m, idx) => {
              const isMe = m.uid === user?.uid;
              const memberBal = balances?.[m.uid];
              const totalPaid = Number(memberBal?.totalPaid || 0);
              const totalShare = Number(memberBal?.totalShare || 0);
              const netBal = Number(memberBal?.netBalance || 0);

              const mIsOwed = netBal > 0.01;
              const mOwes = netBal < -0.01;
              const memberName = m?.name || (isMe ? "You" : "Flatmate");
              const initial = memberName.charAt(0).toUpperCase() || "F";
              const shortName = isMe ? `${memberName} (You)` : memberName;

              const debtOwedByMe = !isMe
                ? pairwiseDebts.find((d) => d.fromUid === user?.uid && d.toUid === m.uid)
                : null;
              const debtOwedToMe = !isMe
                ? pairwiseDebts.find((d) => d.toUid === user?.uid && d.fromUid === m.uid)
                : null;

              return (
                <View
                  key={m.uid}
                  style={[
                    styles.memberRow,
                    idx < membersList.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  {/* Left: Avatar + Name + Paid / Share Subtitle */}
                  <View style={styles.memberLeftCol}>
                    <View
                      style={[
                        styles.avatarCircle,
                        {
                          backgroundColor: isMe
                            ? colors.primary
                            : isDark
                            ? "rgba(255,255,255,0.1)"
                            : "rgba(0,0,0,0.06)",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.avatarText,
                          { color: isMe ? "#FFFFFF" : colors.foreground },
                        ]}
                      >
                        {initial}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.memberNameText,
                          { color: isMe ? colors.primary : colors.foreground },
                          isMe && { fontFamily: "Inter_700Bold" },
                        ]}
                        numberOfLines={1}
                      >
                        {shortName}
                      </Text>
                      <Text style={[styles.memberSubText, { color: colors.mutedForeground }]}>
                        Paid: ₹{totalPaid.toLocaleString("en-IN")} · Share: ₹{totalShare.toLocaleString("en-IN")}
                      </Text>
                    </View>
                  </View>

                  {/* Right: Net Position & 1-Tap Settle */}
                  <View style={styles.memberRightCol}>
                    {debtOwedByMe && debtOwedByMe.amount > 0 && onSettleDebt ? (
                      <TouchableOpacity
                        style={[styles.quickSettleBtn, { backgroundColor: colors.primary }]}
                        onPress={() => {
                          safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          onSettleDebt(debtOwedByMe);
                        }}
                        activeOpacity={0.8}
                      >
                        <Feather name="zap" size={11} color="#FFFFFF" />
                        <Text style={styles.quickSettleBtnText}>
                          Settle ₹{debtOwedByMe.amount.toFixed(0)}
                        </Text>
                      </TouchableOpacity>
                    ) : debtOwedToMe && debtOwedToMe.amount > 0 && onSettleDebt ? (
                      <TouchableOpacity
                        style={[
                          styles.quickSettleBtn,
                          {
                            backgroundColor: isDark ? "rgba(16, 185, 129, 0.18)" : "#ECFDF5",
                            borderWidth: 1,
                            borderColor: "#10B981",
                          },
                        ]}
                        onPress={() => {
                          safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          onSettleDebt(debtOwedToMe);
                        }}
                        activeOpacity={0.8}
                      >
                        <Feather name="check" size={11} color="#10B981" />
                        <Text style={[styles.quickSettleBtnText, { color: "#10B981" }]}>
                          Got ₹{debtOwedToMe.amount.toFixed(0)}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <>
                        <Text
                          style={[
                            styles.memberBalanceText,
                            {
                              color: mIsOwed
                                ? "#10B981"
                                : mOwes
                                ? "#EF4444"
                                : colors.mutedForeground,
                            },
                          ]}
                        >
                          {mIsOwed
                            ? `+₹${netBal.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
                            : mOwes
                            ? `-₹${Math.abs(netBal).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
                            : "Even"}
                        </Text>
                        <Text
                          style={[
                            styles.memberStatusLabel,
                            {
                              color: mIsOwed
                                ? "#10B981"
                                : mOwes
                                ? "#EF4444"
                                : colors.mutedForeground,
                            },
                          ]}
                        >
                          {mIsOwed ? "gets back" : mOwes ? "owes" : "settled"}
                        </Text>
                      </>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 20,
    marginBottom: 16,
    gap: 14,
  },
  emptyContainer: {
    padding: 24,
    borderRadius: 20,
    alignItems: "center",
    marginBottom: 16,
  },
  emptyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    marginBottom: 4,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  createBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleWrap: {
    flex: 1,
    gap: 2,
  },
  householdName: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  memberCountText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  codeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  codeText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  settingsBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  heroStatusBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  heroTextCol: {
    flex: 1,
    gap: 2,
  },
  heroSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  heroAmount: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  heroRightBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  heroRightBadgeText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  heroSettleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  heroSettleBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  quickSettleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  quickSettleBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  membersSection: {
    gap: 8,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.6,
  },
  membersList: {
    gap: 4,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  memberLeftCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  memberNameText: {
    fontSize: 13.5,
    fontFamily: "Inter_600SemiBold",
  },
  memberSubText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  memberRightCol: {
    alignItems: "flex-end",
    gap: 1,
  },
  memberBalanceText: {
    fontSize: 13.5,
    fontFamily: "Inter_700Bold",
  },
  memberStatusLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    textTransform: "capitalize",
  },
});
