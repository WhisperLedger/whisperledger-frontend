import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { isDarkPalette } from "@/utils/designSystem";
import { safeHaptics } from "@/utils/haptics";

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelectPersonalExpense: () => void;
  onSelectHouseholdSplit: () => void;
  onSelectReceivable: () => void;
  onSelectSettleUp: () => void;
  hasHousehold: boolean;
}

export default function QuickActionMenu({
  visible,
  onClose,
  onSelectPersonalExpense,
  onSelectHouseholdSplit,
  onSelectReceivable,
  onSelectSettleUp,
  hasHousehold,
}: Props) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const isDark = isDarkPalette(colors);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.sheet,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  paddingBottom: Math.max(insets.bottom + 16, 24),
                },
              ]}
            >
              <View style={styles.handle} />
              
              <Text style={[styles.title, { color: colors.foreground }]}>Add to your ledger</Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                Choose what you want to record.
              </Text>

              <View style={styles.actionsList}>
                {/* 1. Personal Spend */}
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#F8FAFC", borderColor: colors.border }]}
                  onPress={() => {
                    safeHaptics.selectionAsync();
                    onClose();
                    onSelectPersonalExpense();
                  }}
                  activeOpacity={0.75}
                >
                  <View style={[styles.actionIcon, { backgroundColor: "rgba(56, 130, 255, 0.15)" }]}>
                    <Feather name="credit-card" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.actionTitle, { color: colors.foreground }]}>Personal Expense</Text>
                    <Text style={[styles.actionDesc, { color: colors.mutedForeground }]}>
                      Log a daily spend, food, shopping or bill
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>

                {/* 2. Household Split */}
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#F8FAFC", borderColor: colors.border }]}
                  onPress={() => {
                    safeHaptics.selectionAsync();
                    onClose();
                    onSelectHouseholdSplit();
                  }}
                  activeOpacity={0.75}
                >
                  <View style={[styles.actionIcon, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
                    <Feather name="users" size={18} color="#D97706" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.actionTitle, { color: colors.foreground }]}>Shared expense</Text>
                    <Text style={[styles.actionDesc, { color: colors.mutedForeground }]}>
                      Add a bill or purchase shared with your household
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>

                {/* 3. Money Lent / Borrowed (Receivable) */}
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#F8FAFC", borderColor: colors.border }]}
                  onPress={() => {
                    safeHaptics.selectionAsync();
                    onClose();
                    onSelectReceivable();
                  }}
                  activeOpacity={0.75}
                >
                  <View style={[styles.actionIcon, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
                    <Feather name="arrow-up-right" size={18} color="#10B981" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.actionTitle, { color: colors.foreground }]}>Money owed back</Text>
                    <Text style={[styles.actionDesc, { color: colors.mutedForeground }]}>
                      Track a refund or money someone needs to return
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>

                {/* 4. Settle Up (If Flat Active) */}
                {hasHousehold && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#F8FAFC", borderColor: colors.border }]}
                    onPress={() => {
                      safeHaptics.selectionAsync();
                      onClose();
                      onSelectSettleUp();
                    }}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.actionIcon, { backgroundColor: "rgba(99, 102, 241, 0.15)" }]}>
                      <Feather name="zap" size={18} color="#6366F1" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.actionTitle, { color: colors.foreground }]}>Record a settlement</Text>
                      <Text style={[styles.actionDesc, { color: colors.mutedForeground }]}>
                        Mark a shared balance as paid
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(150,150,150,0.4)",
    alignSelf: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
    marginBottom: 16,
  },
  actionsList: {
    gap: 10,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  actionDesc: {
    fontSize: 11.5,
    fontFamily: "Inter_400Regular",
  },
});
