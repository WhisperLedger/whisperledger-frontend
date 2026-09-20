import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useHousehold } from "@/context/HouseholdContext";
import { useColors } from "@/hooks/useColors";
import { isDarkPalette } from "@/utils/designSystem";
import { safeHaptics } from "@/utils/haptics";

interface Props {
  visible: boolean;
  onClose: () => void;
  preselectedDebt?: {
    fromUid: string;
    fromName: string;
    toUid: string;
    toName: string;
    amount: number;
  } | null;
}

export default function SettleUpModal({ visible, onClose, preselectedDebt }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const isDark = isDarkPalette(colors);
  const { user } = useAuth();
  const { currentHousehold, pairwiseDebts, settleUp } = useHousehold();

  const [selectedRecipientUid, setSelectedRecipientUid] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [isReceiving, setIsReceiving] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardHeight(0)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Pre-fill debt details
  useEffect(() => {
    if (visible && currentHousehold) {
      if (preselectedDebt) {
        const iAmDebtor = preselectedDebt.fromUid === user?.uid;
        const otherPersonUid = iAmDebtor ? preselectedDebt.toUid : preselectedDebt.fromUid;
        setSelectedRecipientUid(otherPersonUid);
        setAmount(String(preselectedDebt.amount));
        setIsReceiving(!iAmDebtor);
      } else {
        const userOwes = pairwiseDebts.find((d) => d.fromUid === user?.uid);
        if (userOwes) {
          setSelectedRecipientUid(userOwes.toUid);
          setAmount(String(userOwes.amount));
          setIsReceiving(false);
        } else {
          const owesUser = pairwiseDebts.find((d) => d.toUid === user?.uid);
          if (owesUser) {
            setSelectedRecipientUid(owesUser.fromUid);
            setAmount(String(owesUser.amount));
            setIsReceiving(true);
          } else {
            const otherMember = Object.values(currentHousehold.members).find(
              (m) => m.uid !== user?.uid
            );
            if (otherMember) {
              setSelectedRecipientUid(otherMember.uid);
              setAmount("");
              setIsReceiving(false);
            }
          }
        }
      }
      setNotes("");
    }
  }, [visible, currentHousehold, pairwiseDebts, preselectedDebt, user]);

  const handleSelectMember = (uid: string) => {
    safeHaptics.selectionAsync();
    setSelectedRecipientUid(uid);
    const specificDebtOwedByMe = pairwiseDebts.find(
      (d) => d.fromUid === user?.uid && d.toUid === uid
    );
    const specificDebtOwedToMe = pairwiseDebts.find(
      (d) => d.toUid === user?.uid && d.fromUid === uid
    );

    if (specificDebtOwedByMe) {
      setAmount(String(specificDebtOwedByMe.amount));
      setIsReceiving(false);
    } else if (specificDebtOwedToMe) {
      setAmount(String(specificDebtOwedToMe.amount));
      setIsReceiving(true);
    }
  };

  const handlePayUPI = async () => {
    const parsedAmt = parseFloat(amount);
    if (!parsedAmt || parsedAmt <= 0) return;

    const targetMember = currentHousehold?.members[selectedRecipientUid];
    const recipientName = targetMember?.name || "Flatmate";
    const noteText = notes.trim() || `[${currentHousehold?.name}] Settlement`;
    const upiUrl = `upi://pay?pn=${encodeURIComponent(recipientName)}&am=${parsedAmt.toFixed(2)}&cu=INR&tn=${encodeURIComponent(noteText)}`;

    try {
      const supported = await Linking.canOpenURL(upiUrl);
      if (supported) {
        await Linking.openURL(upiUrl);
      } else {
        Alert.alert(
          "UPI App Not Found",
          "Please open Google Pay, PhonePe, or Paytm on your phone to complete payment."
        );
      }
    } catch {
      Alert.alert("Error", "Could not open UPI app.");
    }
  };

  const handleSettle = async () => {
    const parsedAmt = parseFloat(amount);
    if (!selectedRecipientUid || !parsedAmt || parsedAmt <= 0) {
      Alert.alert("Invalid Input", "Please enter a valid amount and recipient.");
      return;
    }

    setSubmitting(true);
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // If I am receiving from member, member is payer, I am recipient
    const payerUid = isReceiving ? selectedRecipientUid : user?.uid;
    const recipientUid = isReceiving ? user?.uid! : selectedRecipientUid;

    const res = await settleUp(
      recipientUid,
      parsedAmt,
      notes.trim() || undefined,
      payerUid
    );

    setSubmitting(false);
    if (res.success) {
      safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } else {
      Alert.alert("Settlement Failed", res.error || "Could not record settlement.");
    }
  };

  if (!currentHousehold) return null;

  const otherMembers = Object.values(currentHousehold.members).filter(
    (m) => m.uid !== user?.uid
  );

  const myDebtsOwed = pairwiseDebts.filter((d) => d.fromUid === user?.uid);
  const myDebtsReceivable = pairwiseDebts.filter((d) => d.toUid === user?.uid);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: colors.foreground }]}>
                Settle Up Dues
              </Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                Clear flatmate balances with 1-tap
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.closeBtn,
                { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" },
              ]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Feather name="x" size={18} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 16, paddingBottom: 24 }}
          >
            {otherMembers.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 24, gap: 12 }}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)", alignItems: "center", justifyContent: "center" }}>
                  <Feather name="users" size={24} color={colors.mutedForeground} />
                </View>
                <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15, textAlign: "center" }}>
                  No Flatmates in Household Yet
                </Text>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center", paddingHorizontal: 20 }}>
                  Invite flatmates with code <Text style={{ fontFamily: "Inter_700Bold", color: colors.primary }}>{currentHousehold.inviteCode}</Text> to split expenses and settle dues together.
                </Text>
              </View>
            ) : (
              <>
                {/* Quick 1-Tap Settle Cards if there are active debts */}
                {(myDebtsOwed.length > 0 || myDebtsReceivable.length > 0) && (
                  <View style={{ gap: 8 }}>
                    <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                      PENDING DUES
                    </Text>
                    {myDebtsOwed.map((debt) => (
                      <TouchableOpacity
                        key={`owed_${debt.toUid}`}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: 12,
                          borderRadius: 14,
                          backgroundColor: isDark ? "rgba(239,68,68,0.12)" : "#FEF2F2",
                          borderWidth: 1,
                          borderColor: isDark ? "rgba(239,68,68,0.3)" : "#FECACA",
                        }}
                        onPress={() => {
                          setSelectedRecipientUid(debt.toUid);
                          setAmount(String(debt.amount));
                          setIsReceiving(false);
                          safeHaptics.selectionAsync();
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={{ gap: 2 }}>
                          <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                            You owe {debt.toName}
                          </Text>
                          <Text style={{ color: "#EF4444", fontFamily: "Inter_700Bold", fontSize: 15 }}>
                            ₹{debt.amount.toFixed(0)}
                          </Text>
                        </View>
                        <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: colors.primary }}>
                          <Text style={{ color: "#FFFFFF", fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                            Settle Now
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}

                    {myDebtsReceivable.map((debt) => (
                      <TouchableOpacity
                        key={`receivable_${debt.fromUid}`}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: 12,
                          borderRadius: 14,
                          backgroundColor: isDark ? "rgba(16,185,129,0.12)" : "#ECFDF5",
                          borderWidth: 1,
                          borderColor: isDark ? "rgba(16,185,129,0.3)" : "#A7F3D0",
                        }}
                        onPress={() => {
                          setSelectedRecipientUid(debt.fromUid);
                          setAmount(String(debt.amount));
                          setIsReceiving(true);
                          safeHaptics.selectionAsync();
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={{ gap: 2 }}>
                          <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                            {debt.fromName} owes you
                          </Text>
                          <Text style={{ color: "#10B981", fontFamily: "Inter_700Bold", fontSize: 15 }}>
                            ₹{debt.amount.toFixed(0)}
                          </Text>
                        </View>
                        <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: "#10B981" }}>
                          <Text style={{ color: "#FFFFFF", fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                            Mark Received
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Recipient Selector */}
                <View>
                  <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                    SELECT FLATMATE
                  </Text>
                  <View style={styles.membersGrid}>
                    {otherMembers.map((m) => {
                      const isSelected = selectedRecipientUid === m.uid;
                      const debt = pairwiseDebts.find(
                        (d) => d.fromUid === user?.uid && d.toUid === m.uid
                      );

                      return (
                        <TouchableOpacity
                          key={m.uid}
                          style={[
                            styles.memberCard,
                            {
                              backgroundColor: isDark
                                ? isSelected
                                  ? "rgba(56, 130, 255, 0.2)"
                                  : "rgba(255,255,255,0.04)"
                                : isSelected
                                ? "rgba(0, 102, 255, 0.08)"
                                : "rgba(0,0,0,0.03)",
                              borderColor: isSelected ? colors.primary : colors.border,
                            },
                          ]}
                          onPress={() => handleSelectMember(m.uid)}
                          activeOpacity={0.7}
                        >
                          <View
                            style={[
                              styles.avatar,
                              {
                                backgroundColor: isSelected
                                  ? colors.primary
                                  : isDark
                                  ? "rgba(255,255,255,0.1)"
                                  : "rgba(0,0,0,0.08)",
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.avatarText,
                                { color: isSelected ? "#FFFFFF" : colors.foreground },
                              ]}
                            >
                              {m.name.charAt(0).toUpperCase()}
                            </Text>
                          </View>

                          <Text
                            style={[
                              styles.memberNameText,
                              {
                                color: colors.foreground,
                                fontFamily: isSelected ? "Inter_600SemiBold" : "Inter_500Medium",
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {m.name}
                          </Text>

                          {debt && debt.amount > 0 && (
                            <Text style={[styles.debtBadgeText, { color: "#EF4444" }]}>
                              Owe ₹{debt.amount.toFixed(0)}
                            </Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Amount Input */}
                <View>
                  <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                    SETTLEMENT AMOUNT
                  </Text>
                  <View
                    style={[
                      styles.amountInputWrap,
                      {
                        backgroundColor: isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.02)",
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.currencySymbol, { color: colors.primary }]}>₹</Text>
                    <TextInput
                      style={[styles.amountInput, { color: colors.foreground }]}
                      placeholder="0.00"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="decimal-pad"
                      value={amount}
                      onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ""))}
                      onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120)}
                    />
                  </View>
                </View>

                {/* Note Input */}
                <View>
                  <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                    NOTE (OPTIONAL)
                  </Text>
                  <TextInput
                    style={[
                      styles.noteInput,
                      {
                        backgroundColor: isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.02)",
                        borderColor: colors.border,
                        color: colors.foreground,
                      },
                    ]}
                    placeholder="e.g. Paid via GPay / Cash"
                    placeholderTextColor={colors.mutedForeground}
                    value={notes}
                    onChangeText={setNotes}
                    onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120)}
                  />
                </View>

                {/* Action Buttons */}
                <View style={{ gap: 10, marginTop: 4 }}>
                  {!isReceiving && (
                    <TouchableOpacity
                      style={[
                        styles.upiBtn,
                        {
                          backgroundColor: isDark ? "rgba(56, 130, 255, 0.15)" : "#EFF6FF",
                          borderColor: colors.primary,
                        },
                        (!amount || parseFloat(amount) <= 0) && { opacity: 0.5 },
                      ]}
                      onPress={handlePayUPI}
                      disabled={!amount || parseFloat(amount) <= 0}
                      activeOpacity={0.8}
                    >
                      <Feather name="external-link" size={16} color={colors.primary} />
                      <Text style={[styles.upiBtnText, { color: colors.primary }]}>
                        Pay via UPI App (GPay / PhonePe / Paytm)
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Submit Button */}
                  <TouchableOpacity
                    style={[
                      styles.submitBtn,
                      { backgroundColor: colors.primary },
                      (!amount || parseFloat(amount) <= 0 || submitting) && { opacity: 0.5 },
                    ]}
                    onPress={handleSettle}
                    disabled={!amount || parseFloat(amount) <= 0 || submitting}
                    activeOpacity={0.8}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <>
                        <Feather name="check" size={16} color="#FFFFFF" />
                        <Text style={styles.submitBtnText}>
                          {isReceiving ? "Record Payment Received" : "Mark as Settled (Paid)"}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    padding: 20,
    maxHeight: "92%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  membersGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  memberCard: {
    flex: 1,
    minWidth: 100,
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 4,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  memberNameText: {
    fontSize: 12,
    textAlign: "center",
  },
  debtBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  amountInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  currencySymbol: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    marginRight: 8,
  },
  amountInput: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    flex: 1,
    padding: 0,
  },
  noteInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
  },
  upiBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  upiBtnText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
});
