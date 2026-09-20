import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useAuth } from "@/context/AuthContext";
import { useHousehold } from "@/context/HouseholdContext";
import { useColors } from "@/hooks/useColors";
import { ExpenseSplit, HouseholdMember, SplitType } from "@/types/household";
import { isDarkPalette } from "@/utils/designSystem";
import { safeHaptics } from "@/utils/haptics";
import { calculateEqualSplits, validateVariableSplits } from "@/utils/splitMath";

export interface SplitState {
  isHousehold: boolean;
  splitType: SplitType;
  payerUid: string;
  payerName: string;
  splits: ExpenseSplit[];
  isValid: boolean;
}

interface Props {
  amount: number;
  onSplitChange: (state: SplitState) => void;
  defaultIsHousehold?: boolean;
}

export default function SplitExpenseSelector({
  amount,
  onSplitChange,
  defaultIsHousehold = false,
}: Props) {
  const colors = useColors();
  const isDark = isDarkPalette(colors);
  const { user } = useAuth();
  const { currentHousehold } = useHousehold();

  const [isHousehold, setIsHousehold] = useState(defaultIsHousehold);
  const [splitType, setSplitType] = useState<SplitType>("equal");
  const [payerUid, setPayerUid] = useState(user?.uid || "");
  const [selectedMemberUids, setSelectedMemberUids] = useState<string[]>([]);
  const [variableAmounts, setVariableAmounts] = useState<Record<string, string>>({});

  const membersList: HouseholdMember[] = useMemo(() => {
    if (!currentHousehold?.members) return [];
    return Object.values(currentHousehold.members);
  }, [currentHousehold]);

  // Default select all household members
  useEffect(() => {
    if (membersList.length > 0) {
      setSelectedMemberUids(membersList.map((m) => m.uid));
      if (!payerUid && user?.uid) {
        setPayerUid(user.uid);
      }
    }
  }, [membersList]);

  // Compute splits & validity
  const activeMembers = useMemo(() => {
    return membersList.filter((m) => selectedMemberUids.includes(m.uid));
  }, [membersList, selectedMemberUids]);

  const payerName = useMemo(() => {
    if (payerUid === user?.uid) return user?.name || "You";
    const found = membersList.find((m) => m.uid === payerUid);
    return found?.name || "Flatmate";
  }, [payerUid, user, membersList]);

  const { calculatedSplits, isValid, diffRemaining } = useMemo(() => {
    if (!isHousehold) {
      return { calculatedSplits: [], isValid: true, diffRemaining: 0 };
    }

    if (activeMembers.length === 0 || amount <= 0) {
      return { calculatedSplits: [], isValid: false, diffRemaining: amount };
    }

    if (splitType === "equal") {
      const splits = calculateEqualSplits(
        amount,
        activeMembers.map((m) => ({ uid: m.uid, name: m.name, avatarUri: m.avatarUri })),
        payerUid
      );
      return { calculatedSplits: splits, isValid: true, diffRemaining: 0 };
    } else {
      // Variable splits
      const splits: ExpenseSplit[] = activeMembers.map((m) => {
        const customAmt = parseFloat(variableAmounts[m.uid] || "0") || 0;
        return {
          uid: m.uid,
          name: m.name,
          avatarUri: m.avatarUri,
          share: customAmt,
          percentage: amount > 0 ? Number(((customAmt / amount) * 100).toFixed(1)) : 0,
        };
      });

      const validation = validateVariableSplits(amount, splits);
      return {
        calculatedSplits: splits,
        isValid: validation.isValid,
        diffRemaining: validation.difference,
      };
    }
  }, [isHousehold, splitType, activeMembers, amount, payerUid, variableAmounts]);

  // Inform parent of split state updates
  useEffect(() => {
    onSplitChange({
      isHousehold,
      splitType,
      payerUid: payerUid || user?.uid || "",
      payerName,
      splits: calculatedSplits,
      isValid,
    });
  }, [isHousehold, splitType, payerUid, payerName, calculatedSplits, isValid, onSplitChange, user]);

  if (!currentHousehold) {
    return null; // Not in a household, nothing to show
  }

  const toggleMemberSelection = (uid: string) => {
    safeHaptics.selectionAsync();
    if (selectedMemberUids.includes(uid)) {
      if (selectedMemberUids.length === 1) return; // Keep at least one
      setSelectedMemberUids((prev) => prev.filter((id) => id !== uid));
    } else {
      setSelectedMemberUids((prev) => [...prev, uid]);
    }
  };

  const handleVariableChange = (uid: string, text: string) => {
    const sanitized = text.replace(/[^0-9.]/g, "");
    setVariableAmounts((prev) => ({ ...prev, [uid]: sanitized }));
  };

  return (
    <View style={styles.container}>
      {/* Space Mode Toggle */}
      <View style={styles.modeToggleRow}>
        <TouchableOpacity
          style={[
            styles.modeButton,
            !isHousehold && [
              styles.modeButtonActive,
              {
                backgroundColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.05)",
                borderColor: colors.primary,
              },
            ],
          ]}
          onPress={() => {
            safeHaptics.selectionAsync();
            setIsHousehold(false);
          }}
          activeOpacity={0.7}
        >
          <Feather
            name="user"
            size={14}
            color={!isHousehold ? colors.primary : colors.mutedForeground}
          />
          <Text
            style={[
              styles.modeButtonText,
              {
                color: !isHousehold ? colors.foreground : colors.mutedForeground,
                fontFamily: !isHousehold ? "Inter_600SemiBold" : "Inter_500Medium",
              },
            ]}
          >
            Personal Only
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.modeButton,
            isHousehold && [
              styles.modeButtonActive,
              {
                backgroundColor: isDark ? "rgba(56, 130, 255, 0.15)" : "rgba(0, 102, 255, 0.08)",
                borderColor: colors.primary,
              },
            ],
          ]}
          onPress={() => {
            safeHaptics.selectionAsync();
            setIsHousehold(true);
          }}
          activeOpacity={0.7}
        >
          <Feather
            name="users"
            size={14}
            color={isHousehold ? colors.primary : colors.mutedForeground}
          />
          <Text
            style={[
              styles.modeButtonText,
              {
                color: isHousehold ? colors.primary : colors.mutedForeground,
                fontFamily: isHousehold ? "Inter_600SemiBold" : "Inter_500Medium",
              },
            ]}
          >
            Split with Household
          </Text>
        </TouchableOpacity>
      </View>

      {/* Household Split Section */}
      {isHousehold && (
        <View
          style={[
            styles.splitBox,
            {
              backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.02)",
              borderColor: colors.border,
            },
          ]}
        >
          {/* Header Info */}
          <View style={styles.splitBoxHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Feather name="home" size={15} color={colors.primary} />
              <Text style={[styles.householdTitle, { color: colors.foreground }]}>
                {currentHousehold.name}
              </Text>
            </View>

            {/* Split Type Pill */}
            <View style={styles.splitTypeRow}>
              <TouchableOpacity
                style={[
                  styles.splitTypePill,
                  splitType === "equal" && { backgroundColor: colors.primary },
                ]}
                onPress={() => {
                  safeHaptics.selectionAsync();
                  setSplitType("equal");
                }}
              >
                <Text
                  style={[
                    styles.splitTypePillText,
                    { color: splitType === "equal" ? "#FFFFFF" : colors.mutedForeground },
                  ]}
                >
                  Equal (÷)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.splitTypePill,
                  splitType === "variable" && { backgroundColor: colors.primary },
                ]}
                onPress={() => {
                  safeHaptics.selectionAsync();
                  setSplitType("variable");
                }}
              >
                <Text
                  style={[
                    styles.splitTypePillText,
                    { color: splitType === "variable" ? "#FFFFFF" : colors.mutedForeground },
                  ]}
                >
                  Exact (₹)
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Payer Selector */}
          <View style={styles.payerRow}>
            <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
              Paid by:
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {membersList.map((m) => {
                  const isPayer = payerUid === m.uid;
                  const isMe = m.uid === user?.uid;
                  return (
                    <TouchableOpacity
                      key={m.uid}
                      style={[
                        styles.payerChip,
                        isPayer
                          ? {
                              backgroundColor: isDark
                                ? "rgba(56, 130, 255, 0.25)"
                                : "rgba(0, 102, 255, 0.12)",
                              borderColor: colors.primary,
                            }
                          : { borderColor: colors.border },
                      ]}
                      onPress={() => {
                        safeHaptics.selectionAsync();
                        setPayerUid(m.uid);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.payerChipText,
                          {
                            color: isPayer ? colors.primary : colors.mutedForeground,
                            fontFamily: isPayer ? "Inter_600SemiBold" : "Inter_400Regular",
                          },
                        ]}
                      >
                        {isMe ? "You" : m.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          {/* Members & Split Shares */}
          <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground, marginTop: 12 }]}>
            Split among:
          </Text>

          <View style={styles.membersListWrap}>
            {membersList.map((m) => {
              const isSelected = selectedMemberUids.includes(m.uid);
              const splitItem = calculatedSplits.find((s) => s.uid === m.uid);
              const shareAmount = splitItem ? splitItem.share : 0;
              const isMe = m.uid === user?.uid;

              return (
                <View
                  key={m.uid}
                  style={[
                    styles.memberRow,
                    {
                      backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "#FFFFFF",
                      borderColor: isSelected ? colors.primary : colors.border,
                      opacity: isSelected ? 1 : 0.6,
                    },
                  ]}
                >
                  <TouchableOpacity
                    style={styles.memberLeft}
                    onPress={() => toggleMemberSelection(m.uid)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        isSelected
                          ? { backgroundColor: colors.primary, borderColor: colors.primary }
                          : { borderColor: colors.mutedForeground },
                      ]}
                    >
                      {isSelected && <Feather name="check" size={12} color="#FFFFFF" />}
                    </View>

                    <Text
                      style={[
                        styles.memberName,
                        {
                          color: colors.foreground,
                          fontFamily: isMe ? "Inter_600SemiBold" : "Inter_500Medium",
                        },
                      ]}
                    >
                      {isMe ? `${m.name} (You)` : m.name}
                    </Text>
                  </TouchableOpacity>

                  {/* Share Input or Calculated View */}
                  {isSelected && (
                    <View style={styles.shareWrap}>
                      {splitType === "equal" ? (
                        <Text style={[styles.equalShareText, { color: colors.primary }]}>
                          ₹{shareAmount.toFixed(2)}
                        </Text>
                      ) : (
                        <View
                          style={[
                            styles.exactInputWrap,
                            {
                              borderColor: colors.border,
                              backgroundColor: isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.03)",
                            },
                          ]}
                        >
                          <Text style={[styles.currencyPrefix, { color: colors.mutedForeground }]}>
                            ₹
                          </Text>
                          <TextInput
                            style={[styles.exactInput, { color: colors.foreground }]}
                            placeholder="0"
                            placeholderTextColor={colors.mutedForeground}
                            keyboardType="decimal-pad"
                            value={variableAmounts[m.uid] || ""}
                            onChangeText={(text) => handleVariableChange(m.uid, text)}
                          />
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {/* Variable Split Balance Helper */}
          {splitType === "variable" && (
            <View style={styles.variableHelper}>
              {Math.abs(diffRemaining) < 0.01 ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Feather name="check-circle" size={14} color="#10B981" />
                  <Text style={[styles.helperSuccess, { color: "#10B981" }]}>
                    Exact amount allocated (₹{amount})
                  </Text>
                </View>
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Feather name="alert-circle" size={14} color="#EF4444" />
                  <Text style={[styles.helperError, { color: "#EF4444" }]}>
                    {diffRemaining > 0
                      ? `₹${diffRemaining.toFixed(2)} remaining to allocate`
                      : `₹${Math.abs(diffRemaining).toFixed(2)} over allocated`}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  modeToggleRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  modeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "transparent",
  },
  modeButtonActive: {
    borderWidth: 1.5,
  },
  modeButtonText: {
    fontSize: 13,
  },
  splitBox: {
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
  },
  splitBoxHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  householdTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  splitTypeRow: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.08)",
    padding: 2,
    borderRadius: 12,
    gap: 2,
  },
  splitTypePill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  splitTypePillText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  payerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  payerChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  payerChipText: {
    fontSize: 12,
  },
  membersListWrap: {
    gap: 6,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  memberLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  memberName: {
    fontSize: 13,
  },
  shareWrap: {
    alignItems: "flex-end",
  },
  equalShareText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  exactInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    width: 90,
  },
  currencyPrefix: {
    fontSize: 12,
    marginRight: 2,
  },
  exactInput: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    padding: 0,
    flex: 1,
  },
  variableHelper: {
    marginTop: 6,
    alignItems: "center",
  },
  helperSuccess: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  helperError: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
});
