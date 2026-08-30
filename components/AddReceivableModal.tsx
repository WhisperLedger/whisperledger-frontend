import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";

import { useReceivables } from "@/context/ReceivablesContext";
import { useColors } from "@/hooks/useColors";
import type { ReceivableCategory, ReceivableStatus } from "@/types/receivable";
import { CATEGORY_LABELS } from "@/types/receivable";
import { parseReceivableFromText, calculateDefaultSLA, todayISO } from "@/utils/receivablesParser";
import { safeHaptics } from "@/utils/haptics";
import { validateMerchantName, validateAmount } from "@/utils/validation";
import { isDarkPalette } from "@/utils/designSystem";

interface AddReceivableModalProps {
  visible: boolean;
  onClose: () => void;
}

const QUICK_PRESETS = [
  { name: "Amazon Return", amount: "1299", cat: "ecommerce_return" as ReceivableCategory, note: "Item returned via pickup" },
  { name: "Swiggy Cancel", amount: "450", cat: "food_order" as ReceivableCategory, note: "Order cancelled refund pending" },
  { name: "MakeMyTrip Flight", amount: "4200", cat: "flight_travel" as ReceivableCategory, note: "Airline ticket cancellation" },
  { name: "UPI Reversal", amount: "1000", cat: "failed_upi" as ReceivableCategory, note: "Failed UPI payment pending reversal" },
];

export default function AddReceivableModal({ visible, onClose }: AddReceivableModalProps) {
  const colors = useColors();
  const { addReceivable } = useReceivables();
  const isDark = isDarkPalette(colors);

  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [orderId, setOrderId] = useState("");
  const [category, setCategory] = useState<ReceivableCategory>("ecommerce_return");
  const [status, setStatus] = useState<ReceivableStatus>("REFUND_INITIATED");
  const [notes, setNotes] = useState("");
  const [rawText, setRawText] = useState("");
  const [showSmartPaste, setShowSmartPaste] = useState(false);

  const applyPreset = (preset: typeof QUICK_PRESETS[0]) => {
    setMerchant(preset.name.split(" ")[0]);
    setAmount(preset.amount);
    setCategory(preset.cat);
    setNotes(preset.note);
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSmartParse = () => {
    if (!rawText.trim()) {
      Alert.alert("Empty Text", "Please paste refund SMS or email text first.");
      return;
    }

    const parsed = parseReceivableFromText(rawText);
    if (!parsed) {
      Alert.alert("Auto-Extract", "Couldn't detect merchant & amount automatically. Please enter merchant name & amount below.");
      return;
    }

    setMerchant(parsed.merchant);
    setAmount(parsed.amount.toString());
    setCategory(parsed.category);
    setStatus(parsed.status);
    if (parsed.orderId) setOrderId(parsed.orderId);
    setNotes(parsed.notes);
    setShowSmartPaste(false);
    safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleSave = async () => {
    const merchantCheck = validateMerchantName(merchant);
    if (!merchantCheck.isValid) {
      Alert.alert("Invalid Merchant", merchantCheck.error || "Please enter a valid merchant name.");
      return;
    }

    const amountCheck = validateAmount(amount);
    if (!amountCheck.isValid) {
      Alert.alert("Invalid Amount", amountCheck.error || "Please enter a valid positive refund amount.");
      return;
    }

    const numAmount = parseFloat(amount.replace(/,/g, "").trim());

    const sla = calculateDefaultSLA(merchant, category);
    const dateInit = todayISO();
    const d = new Date();
    d.setDate(d.getDate() + sla.days);
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    await addReceivable(
      {
        merchant: merchant.trim(),
        amount: numAmount,
        category,
        status,
        orderId: orderId.trim() || undefined,
        dateInitiated: dateInit,
        expectedRefundDate: expected,
        promisedWindow: sla.label,
        notes: notes.trim() || undefined,
      },
      "Initial Refund Notice"
    );

    safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Reset
    setRawText("");
    setMerchant("");
    setAmount("");
    setOrderId("");
    setNotes("");
    setShowSmartPaste(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
          {/* Simple Clean Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.foreground }]}>Track Owed Refund</Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                Money Recovery Agent
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
            {/* 1-Tap Quick Presets Bar */}
            <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>1-TAP QUICK PRESETS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll}>
              {QUICK_PRESETS.map((p, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.presetChip, { backgroundColor: isDark ? "rgba(56, 130, 255, 0.12)" : "#F0F7FF", borderColor: colors.border }]}
                  onPress={() => applyPreset(p)}
                >
                  <Text style={[styles.presetText, { color: colors.primary }]}>{p.name} ₹{p.amount}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Smart Text Paste Toggle */}
            <TouchableOpacity
              style={[styles.smartToggle, { backgroundColor: isDark ? "rgba(248, 250, 252, 0.05)" : "rgba(15, 23, 42, 0.04)" }]}
              onPress={() => setShowSmartPaste((v) => !v)}
            >
              <Feather name="zap" size={16} color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={[styles.smartToggleText, { color: colors.foreground }]}>
                {showSmartPaste ? "Hide Text Auto-Extract" : "Paste Refund SMS / Email to Auto-Extract"}
              </Text>
              <Feather name={showSmartPaste ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
            </TouchableOpacity>

            {showSmartPaste && (
              <View style={styles.smartBox}>
                <TextInput
                  style={[styles.smartInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                  multiline
                  numberOfLines={3}
                  placeholder="Paste SMS/Email e.g. 'Amazon return of ₹8,499 for order #402 has been picked up.'"
                  placeholderTextColor={colors.mutedForeground}
                  value={rawText}
                  onChangeText={setRawText}
                />
                <TouchableOpacity style={[styles.parseBtn, { backgroundColor: colors.primary }]} onPress={handleSmartParse}>
                  <Feather name="cpu" size={14} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={styles.parseBtnText}>Auto-Extract Details</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Simple Clean Form */}
            <Text style={[styles.label, { color: colors.foreground, marginTop: 16 }]}>COMPANY / MERCHANT NAME</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              placeholder="e.g. Amazon, Flipkart, Swiggy, MakeMyTrip"
              placeholderTextColor={colors.mutedForeground}
              value={merchant}
              onChangeText={setMerchant}
            />

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={[styles.label, { color: colors.foreground }]}>REFUND AMOUNT (₹)</Text>
                <TextInput
                  style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                  placeholder="e.g. 8499"
                  keyboardType="numeric"
                  placeholderTextColor={colors.mutedForeground}
                  value={amount}
                  onChangeText={setAmount}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={[styles.label, { color: colors.foreground }]}>ORDER ID (OPTIONAL)</Text>
                <TextInput
                  style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                  placeholder="e.g. #AMZ8291"
                  placeholderTextColor={colors.mutedForeground}
                  value={orderId}
                  onChangeText={setOrderId}
                />
              </View>
            </View>

            <Text style={[styles.label, { color: colors.foreground }]}>CATEGORY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {(Object.keys(CATEGORY_LABELS) as ReceivableCategory[]).map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.catChip,
                    {
                      backgroundColor: category === cat ? colors.primary : colors.background,
                      borderColor: category === cat ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[styles.catText, { color: category === cat ? "#fff" : colors.foreground }]}>
                    {CATEGORY_LABELS[cat].label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </ScrollView>

          {/* Primary 1-Tap Action Button */}
          <TouchableOpacity
            style={[
              styles.saveBtn,
              {
                backgroundColor: colors.primary,
                opacity: !merchant.trim() || !amount.trim() || parseFloat(amount) <= 0 ? 0.4 : 1,
              },
            ]}
            disabled={!merchant.trim() || !amount.trim() || parseFloat(amount) <= 0}
            activeOpacity={0.85}
            onPress={handleSave}
          >
            <Feather name="check" size={18} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.saveBtnText}>
              {amount && parseFloat(amount) > 0 ? `Track ₹${amount} Refund` : "Track Pending Refund"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: "88%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  sectionHeader: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  presetScroll: {
    marginBottom: 16,
  },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "rgba(15,118,110,0.25)",
  },
  presetText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#0066FF",
  },
  smartToggle: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  smartToggleText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  smartBox: {
    marginBottom: 16,
  },
  smartInput: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 12,
    fontSize: 13,
    minHeight: 70,
    textAlignVertical: "top",
    fontFamily: "Inter_400Regular",
  },
  parseBtn: {
    backgroundColor: "#0066FF",
    borderRadius: 10,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  parseBtnText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginBottom: 14,
  },
  row: {
    flexDirection: "row",
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  catText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  saveBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
});
