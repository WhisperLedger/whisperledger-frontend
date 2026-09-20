import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { safeHaptics } from "@/utils/haptics";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CATEGORIES, CategoryId, PaymentMode, useExpenses } from "@/context/ExpenseContext";
import { useHousehold } from "@/context/HouseholdContext";
import { useColors } from "@/hooks/useColors";
import MiniCalendar from "./MiniCalendar";
import SplitExpenseSelector, { SplitState } from "./SplitExpenseSelector";
import { isDarkPalette } from "@/utils/designSystem";
import { inferExpenseDraft } from "@/utils/expenseSmartInput";
import MerchantLogo from "./MerchantLogo";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function normalizeISODate(value: any) {
  if (!value || typeof value !== "string") return todayISO();
  const normalized = value.trim();
  const parts = normalized.split("-");
  if (parts.length !== 3) return todayISO();
  const y = parts[0];
  const m = parts[1].padStart(2, "0");
  const d = parts[2].padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isFutureISODate(value: any) {
  if (!value || typeof value !== "string") return false;
  const normalized = normalizeISODate(value);
  return normalized > todayISO();
}

interface Props {
  visible: boolean;
  onClose: () => void;
  defaultDate?: string;
  editExpense?: {
    id: string;
    amount: number;
    categoryId: CategoryId;
    paymentMode?: PaymentMode;
    note: string;
    merchant?: string;
    location?: string;
    date: string;
    isHouseholdExpense?: boolean;
    payerUid?: string;
    payerName?: string;
    splitType?: any;
    splits?: any[];
  } | null;
  defaultIsHousehold?: boolean;
}

const QUICK_INCREMENTS = [50, 100, 500, 2000];

const GENZ_VIBES: { label: string; icon: string; category: CategoryId }[] = [
  { label: "Coffee Run", icon: "coffee", category: "food_outside" },
  { label: "Fast Food", icon: "shopping-bag", category: "food_outside" },
  { label: "Cab / Auto", icon: "navigation", category: "travel" },
  { label: "Grocery Drop", icon: "shopping-cart", category: "groceries" },
  { label: "Maid / Cook", icon: "user-check", category: "maid_cook" },
  { label: "Movie Night", icon: "film", category: "entertainment" },
  { label: "Party / Treat", icon: "gift", category: "entertainment" },
  { label: "Utility Bill", icon: "zap", category: "utilities" },
];

function paymentIcon(mode: PaymentMode) {
  if (mode === "upi") return "zap";
  if (mode === "card") return "credit-card";
  if (mode === "cash") return "dollar-sign";
  if (mode === "netbanking") return "briefcase";
  return "minus-circle";
}

export default function AddExpenseModal({
  visible,
  onClose,
  defaultDate,
  editExpense,
  defaultIsHousehold = false,
}: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addExpense, updateExpense, getTotalForDate } = useExpenses();
  const { activeSpace, addHouseholdExpense, updateHouseholdExpense, currentHousehold } = useHousehold();
  const isDark = isDarkPalette(colors);

  const [amount, setAmount] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>("groceries");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("upi");
  const [note, setNote] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [splitState, setSplitState] = useState<SplitState | null>(null);

  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const amountRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const slideAnim = useRef(new Animated.Value(400)).current;

  // Animated keyboard padding values
  const keyboardPaddingAnim = useRef(new Animated.Value(24)).current;
  const sheetPaddingAnim = useRef(new Animated.Value(insets.bottom + 20)).current;

  useEffect(() => {
    if (keyboardHeight === 0) {
      sheetPaddingAnim.setValue(insets.bottom + 20);
    }
  }, [insets.bottom]);

  useEffect(() => {
    if (visible) {
      setShowCalendar(false);
      if (editExpense) {
        setAmount(editExpense.amount ? editExpense.amount.toString() : "");
        setSelectedCategory(editExpense.categoryId || "groceries");
        setPaymentMode(editExpense.paymentMode || "upi");
        setNote(editExpense.note || "");
        setLocation(editExpense.location || "");
        setDate(editExpense.date || todayISO());
      } else {
        setAmount("");
        setSelectedCategory("groceries");
        setPaymentMode("upi");
        setNote("");
        setLocation("");
        setDate(defaultDate || todayISO());
      }
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: false,
        damping: 22,
        stiffness: 160,
      }).start();
      setTimeout(() => amountRef.current?.focus(), 350);
    } else {
      Animated.timing(slideAnim, {
        toValue: 400,
        duration: 220,
        useNativeDriver: false,
      }).start();
    }
  }, [visible, editExpense, defaultDate]);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) => {
      const height = e.endCoordinates?.height || 0;
      setKeyboardHeight(height);

      Animated.parallel([
        Animated.timing(keyboardPaddingAnim, {
          toValue: Platform.OS === "ios" ? Math.max(0, height - 20) : 16,
          duration: Platform.OS === "ios" ? (e.duration || 250) : 150,
          useNativeDriver: false,
        }),
        Animated.timing(sheetPaddingAnim, {
          toValue: insets.bottom + 12,
          duration: Platform.OS === "ios" ? (e.duration || 250) : 150,
          useNativeDriver: false,
        })
      ]).start();
    });

    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      setKeyboardHeight(0);

      Animated.parallel([
        Animated.timing(keyboardPaddingAnim, {
          toValue: 24,
          duration: Platform.OS === "ios" ? (e.duration || 200) : 150,
          useNativeDriver: false,
        }),
        Animated.timing(sheetPaddingAnim, {
          toValue: insets.bottom + 20,
          duration: Platform.OS === "ios" ? (e.duration || 200) : 150,
          useNativeDriver: false,
        })
      ]).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [insets.bottom]);

  const handleIncrementAmount = (val: number) => {
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const curr = parseFloat(amount) || 0;
    setAmount(String(curr + val));
  };

  const handleApplyVibe = (vibe: typeof GENZ_VIBES[0]) => {
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCategory(vibe.category);
    if (!note) {
      setNote(vibe.label);
    }
  };

  const parsedAmount = parseFloat(amount) || 0;
  const isFuture = isFutureISODate(date);
  const smartDraft = useMemo(() => inferExpenseDraft(note), [note]);
  const selectedCategoryMeta = useMemo(
    () => CATEGORIES.find((category) => category.id === selectedCategory) || CATEGORIES[0],
    [selectedCategory]
  );
  const editAmountOnSelectedDate = editExpense?.date === date ? Number(editExpense.amount || 0) : 0;
  const projectedDailyTotal = Math.max(0, getTotalForDate(date) - editAmountOnSelectedDate + parsedAmount);
  const inferredMerchant = smartDraft.merchant || editExpense?.merchant || "";
  const hasSmartSuggestion = note.trim().length > 2 && smartDraft.signals.length > 0;
  const isSplitInvalid = splitState?.isHousehold && !splitState.isValid;
  const saveDisabled = !parsedAmount || parsedAmount <= 0 || isFuture || saving || isSplitInvalid;

  const handleApplySmartDraft = () => {
    if (!hasSmartSuggestion) return;
    safeHaptics.selectionAsync();
    if (smartDraft.amount && (!amount.trim() || Number(amount) <= 0)) {
      setAmount(String(smartDraft.amount));
    }
    if (smartDraft.categoryId) setSelectedCategory(smartDraft.categoryId);
    if (smartDraft.paymentMode) setPaymentMode(smartDraft.paymentMode);
    if (smartDraft.cleanedNote && smartDraft.cleanedNote !== note.trim()) {
      setNote(smartDraft.cleanedNote);
    }
  };

  const handleSave = useCallback(async () => {
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0 || isFutureISODate(date) || (splitState?.isHousehold && !splitState.isValid)) return;
    setSaving(true);
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const normalizedDate = normalizeISODate(date);
    try {
      if (splitState?.isHousehold && currentHousehold) {
        // Household Split Save
        const householdPayload = {
          amount: parsed,
          categoryId: selectedCategory,
          paymentMode,
          note: note.trim(),
          location: location.trim() || undefined,
          date: normalizedDate,
          payerUid: splitState.payerUid,
          payerName: splitState.payerName,
          splitType: splitState.splitType,
          splits: splitState.splits,
          ...(inferredMerchant ? { merchant: inferredMerchant } : {}),
        };

        if (editExpense?.isHouseholdExpense) {
          await updateHouseholdExpense(editExpense.id, householdPayload);
        } else {
          await addHouseholdExpense(householdPayload);
        }
      } else {
        // Personal Spend Save
        const expensePayload = {
          amount: parsed,
          categoryId: selectedCategory,
          paymentMode,
          note: note.trim(),
          location: location.trim() || undefined,
          date: normalizedDate,
          ...(inferredMerchant ? { merchant: inferredMerchant } : {}),
        };

        if (editExpense) {
          await updateExpense(editExpense.id, expensePayload);
        } else {
          await addExpense(expensePayload);
        }
      }
      onClose();
    } catch {
      // error handled in context
    } finally {
      setSaving(false);
    }
  }, [
    amount,
    date,
    editExpense,
    inferredMerchant,
    note,
    location,
    paymentMode,
    selectedCategory,
    updateExpense,
    addExpense,
    updateHouseholdExpense,
    addHouseholdExpense,
    onClose,
    splitState,
    currentHousehold,
  ]);

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.65)",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      borderWidth: 1,
      borderColor: colors.border,
      maxHeight: "92%",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -6 },
      shadowOpacity: isDark ? 0.4 : 0.1,
      shadowRadius: 20,
      elevation: 20,
    },
    handleBar: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: "center",
      marginTop: 10,
      marginBottom: 6,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    titleIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: isDark ? "rgba(56, 130, 255, 0.15)" : "#F0F7FF",
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      fontSize: 18,
      fontWeight: "700" as const,
      color: colors.foreground,
      fontFamily: "Inter_700Bold",
    },
    closeBtn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: isDark ? "rgba(255,255,255,0.06)" : colors.muted,
      alignItems: "center",
      justifyContent: "center",
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 10,
    },
    amountHeroWrap: {
      backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "#F8FAFC",
      borderRadius: 20,
      padding: 16,
      marginTop: 14,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    amountRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    currency: {
      fontSize: 32,
      fontWeight: "700" as const,
      color: colors.primary,
      fontFamily: "Inter_700Bold",
      marginRight: 6,
    },
    amountInput: {
      flex: 1,
      fontSize: 38,
      fontWeight: "700" as const,
      color: colors.foreground,
      fontFamily: "Inter_700Bold",
      padding: 0,
    },
    amountMetaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 12,
    },
    amountMetaPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 12,
      backgroundColor: isDark ? "rgba(56, 130, 255, 0.10)" : "#F0F7FF",
      borderWidth: 1,
      borderColor: isDark ? "rgba(56, 130, 255, 0.20)" : "#DBEAFE",
    },
    amountMetaLabel: {
      fontSize: 11,
      fontFamily: "Inter_500Medium",
      color: colors.mutedForeground,
    },
    amountMetaValue: {
      fontSize: 11,
      fontFamily: "Inter_700Bold",
      color: colors.primary,
    },
    chipScroll: {
      flexDirection: "row",
      marginTop: 12,
      gap: 8,
    },
    incrementChip: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: isDark ? "rgba(56, 130, 255, 0.12)" : "#EFF6FF",
      borderWidth: 1,
      borderColor: isDark ? "rgba(56, 130, 255, 0.25)" : "#BFDBFE",
    },
    incrementText: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
      color: colors.primary,
    },
    clearChip: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 10,
      backgroundColor: isDark ? "rgba(239, 68, 68, 0.12)" : "#FEF2F2",
      borderWidth: 1,
      borderColor: isDark ? "rgba(239, 68, 68, 0.25)" : "#FECACA",
    },
    clearText: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
      color: "#EF4444",
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: "600" as const,
      color: colors.mutedForeground,
      fontFamily: "Inter_600SemiBold",
      letterSpacing: 0.8,
      textTransform: "uppercase",
      marginTop: 14,
      marginBottom: 10,
    },
    vibeScroll: {
      marginBottom: 12,
    },
    vibeChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: isDark ? "rgba(56, 130, 255, 0.10)" : "#F0F7FF",
      borderWidth: 1,
      borderColor: isDark ? "rgba(56, 130, 255, 0.20)" : "#DBEAFE",
      marginRight: 8,
    },
    vibeText: {
      fontSize: 12,
      fontFamily: "Inter_500Medium",
      color: colors.foreground,
    },
    // Category grid
    categoryGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "flex-start",
      marginBottom: 6,
    },
    categoryCell: {
      width: "20%",
      alignItems: "center",
      marginBottom: 16,
      gap: 6,
    },
    categoryIconWrap: {
      width: 52,
      height: 52,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
    },
    categoryName: {
      fontSize: 10,
      fontFamily: "Inter_500Medium",
      fontWeight: "500" as const,
      textAlign: "center",
      lineHeight: 13,
    },
    paymentRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 6,
    },
    paymentChip: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 5,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark ? "rgba(255,255,255,0.04)" : colors.card,
    },
    paymentChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    paymentText: {
      fontSize: 12,
      fontFamily: "Inter_500Medium",
      color: colors.foreground,
      textTransform: "capitalize",
    },
    paymentTextActive: {
      color: "#FFFFFF",
      fontFamily: "Inter_600SemiBold",
    },
    noteInput: {
      backgroundColor: isDark ? "rgba(255,255,255,0.04)" : colors.muted,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 13,
      fontSize: 14,
      color: colors.foreground,
      fontFamily: "Inter_400Regular",
      borderWidth: 1,
      borderColor: colors.border,
    },
    smartCard: {
      marginTop: 10,
      padding: 12,
      borderRadius: 16,
      backgroundColor: isDark ? "rgba(56, 130, 255, 0.10)" : "#F0F7FF",
      borderWidth: 1,
      borderColor: isDark ? "rgba(56, 130, 255, 0.22)" : "#BFDBFE",
    },
    smartTopRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    smartIcon: {
      width: 34,
      height: 34,
      borderRadius: 11,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    smartTextWrap: {
      flex: 1,
      minWidth: 0,
    },
    smartTitle: {
      fontSize: 13,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    smartText: {
      marginTop: 2,
      fontSize: 12,
      lineHeight: 17,
      fontFamily: "Inter_500Medium",
      color: colors.mutedForeground,
    },
    smartApplyBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 11,
      backgroundColor: colors.primary,
    },
    smartApplyText: {
      color: "#FFFFFF",
      fontSize: 12,
      fontFamily: "Inter_700Bold",
    },
    previewCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginTop: 16,
      padding: 13,
      borderRadius: 18,
      backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "#FFFFFF",
      borderWidth: 1,
      borderColor: colors.border,
    },
    previewIconFallback: {
      width: 46,
      height: 46,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isDark ? "rgba(56, 130, 255, 0.12)" : "#EFF6FF",
      borderWidth: 1,
      borderColor: isDark ? "rgba(56, 130, 255, 0.22)" : "#DBEAFE",
    },
    previewContent: {
      flex: 1,
      minWidth: 0,
    },
    previewTitle: {
      fontSize: 13,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    previewSub: {
      marginTop: 3,
      fontSize: 12,
      fontFamily: "Inter_500Medium",
      color: colors.mutedForeground,
    },
    previewAmount: {
      fontSize: 16,
      fontFamily: "Inter_700Bold",
      color: colors.primary,
    },
    warningRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: isDark ? "rgba(239, 68, 68, 0.10)" : "#FEF2F2",
      borderWidth: 1,
      borderColor: isDark ? "rgba(239, 68, 68, 0.24)" : "#FECACA",
    },
    warningText: {
      flex: 1,
      color: "#EF4444",
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
    },
    dateRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDark ? "rgba(255,255,255,0.04)" : colors.muted,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 13,
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dateText: {
      flex: 1,
      fontSize: 14,
      color: colors.foreground,
      fontFamily: "Inter_500Medium",
    },
    splitContainer: {
      marginTop: 14,
      padding: 14,
      borderRadius: 14,
      backgroundColor: isDark ? "rgba(56, 130, 255, 0.08)" : "#F0F7FF",
      borderWidth: 1,
      borderColor: isDark ? "rgba(56, 130, 255, 0.2)" : "#BFDBFE",
    },
    splitHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    splitTitle: {
      fontSize: 13,
      fontFamily: "Inter_600SemiBold",
      color: colors.primary,
    },
    splitCounterRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 10,
    },
    splitBtn: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    splitCountText: {
      fontSize: 14,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      minWidth: 60,
      textAlign: "center",
    },
    splitResultText: {
      fontSize: 13,
      fontFamily: "Inter_600SemiBold",
      color: colors.primary,
      marginLeft: "auto",
    },
    saveBtn: {
      marginHorizontal: 20,
      marginBottom: 10,
      marginTop: 14,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 10,
      elevation: 6,
    },
    saveBtnText: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "700" as const,
      fontFamily: "Inter_700Bold",
    },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={() => { Keyboard.dismiss(); onClose(); }}>
        <KeyboardAvoidingView
          style={{ flex: 1, justifyContent: "flex-end" }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
        >
          <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }], paddingBottom: sheetPaddingAnim }]}>
            <Pressable style={{ flexShrink: 1 }} onPress={(e) => e.stopPropagation()}>
              <View style={styles.handleBar} />

              <View style={styles.header}>
                <View style={styles.titleRow}>
                  <View style={styles.titleIcon}>
                    <Feather name={editExpense ? "edit-2" : "plus"} size={16} color={colors.primary} />
                  </View>
                  <Text style={styles.title}>{editExpense ? "Edit Spend" : "Quick Add Spend"}</Text>
                </View>
                <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name="x" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>

              <ScrollView
                ref={scrollViewRef}
                style={{ flexShrink: 1 }}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {/* Hero Amount Input & Quick Increment Chips */}
                <View style={styles.amountHeroWrap}>
                  <View style={styles.amountRow}>
                    <Text style={styles.currency}>₹</Text>
                    <TextInput
                      ref={amountRef}
                      style={styles.amountInput}
                      value={amount}
                      onChangeText={setAmount}
                      placeholder="0"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="decimal-pad"
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                    />
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
                    {QUICK_INCREMENTS.map((val) => (
                      <TouchableOpacity
                        key={val}
                        style={styles.incrementChip}
                        onPress={() => handleIncrementAmount(val)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.incrementText}>+{val}</Text>
                      </TouchableOpacity>
                    ))}
                    {parsedAmount > 0 && (
                      <TouchableOpacity
                        style={styles.clearChip}
                        onPress={() => {
                          safeHaptics.selectionAsync();
                          setAmount("");
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.clearText}>Clear</Text>
                      </TouchableOpacity>
                    )}
                  </ScrollView>

                  <View style={styles.amountMetaRow}>
                    <View style={styles.amountMetaPill}>
                      <Feather name="calendar" size={12} color={colors.primary} />
                      <Text style={styles.amountMetaLabel}>Today</Text>
                      <Text style={styles.amountMetaValue}>₹{projectedDailyTotal.toLocaleString("en-IN")}</Text>
                    </View>
                    {parsedAmount > 0 && (
                      <View style={styles.amountMetaPill}>
                        <Feather name={paymentIcon(paymentMode) as any} size={12} color={colors.primary} />
                        <Text style={styles.amountMetaLabel}>Mode</Text>
                        <Text style={styles.amountMetaValue}>{paymentMode === "none" ? "None" : paymentMode === "netbanking" ? "Bank" : paymentMode.toUpperCase()}</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Gen-Z Quick Vibe / Activity Presets */}
                <Text style={styles.sectionLabel}>Quick Vibes & Moods</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.vibeScroll}>
                  {GENZ_VIBES.map((v, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.vibeChip}
                      onPress={() => handleApplyVibe(v)}
                      activeOpacity={0.75}
                    >
                      <Feather name={v.icon as any} size={13} color={colors.primary} />
                      <Text style={styles.vibeText}>{v.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Category Icon Grid */}
                <Text style={styles.sectionLabel}>Category</Text>
                <View style={styles.categoryGrid}>
                  {CATEGORIES.map((c) => {
                    const isSelected = selectedCategory === c.id;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={styles.categoryCell}
                        onPress={() => {
                          setSelectedCategory(c.id);
                          safeHaptics.selectionAsync();
                        }}
                        activeOpacity={0.75}
                      >
                        <View
                          style={[
                            styles.categoryIconWrap,
                            {
                              backgroundColor: isSelected
                                ? (isDark ? "rgba(56, 130, 255, 0.2)" : "#EFF6FF")
                                : (isDark ? "rgba(255,255,255,0.05)" : colors.muted),
                              borderColor: isSelected ? colors.primary : "transparent",
                              shadowColor: isSelected ? colors.primary : "transparent",
                              shadowOffset: { width: 0, height: 2 },
                              shadowOpacity: isSelected ? 0.35 : 0,
                              shadowRadius: 6,
                              elevation: isSelected ? 4 : 0,
                            },
                          ]}
                        >
                          <Feather
                            name={c.icon as any}
                            size={20}
                            color={isSelected ? colors.primary : colors.mutedForeground}
                          />
                        </View>
                        <Text
                          style={[
                            styles.categoryName,
                            {
                              color: isSelected ? colors.foreground : colors.mutedForeground,
                              fontFamily: isSelected ? "Inter_700Bold" : "Inter_500Medium",
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {c.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Payment Mode */}
                <Text style={styles.sectionLabel}>Payment Mode</Text>
                <View style={styles.paymentRow}>
                  {(["none", "upi", "card", "cash", "netbanking"] as PaymentMode[]).map((mode) => {
                    const isActive = paymentMode === mode;
                    return (
                      <TouchableOpacity
                        key={mode}
                        style={[styles.paymentChip, isActive && styles.paymentChipActive]}
                        onPress={() => {
                          setPaymentMode(mode);
                          safeHaptics.selectionAsync();
                        }}
                      >
                        <Feather
                          name={paymentIcon(mode) as any}
                          size={13}
                          color={isActive ? "#FFFFFF" : colors.primary}
                        />
                        <Text style={[styles.paymentText, isActive && styles.paymentTextActive]} numberOfLines={1}>
                          {mode === "none" ? "None" : mode === "netbanking" ? "Bank" : mode.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Note */}
                <Text style={styles.sectionLabel}>Note / Tag</Text>
                <TextInput
                  style={styles.noteInput}
                  value={note}
                  onChangeText={setNote}
                  placeholder="What was this for?"
                  placeholderTextColor={colors.mutedForeground}
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                  onFocus={() => {
                    setTimeout(() => {
                      scrollViewRef.current?.scrollToEnd({ animated: true });
                    }, 200);
                  }}
                />

                {/* Location Tag */}
                <Text style={styles.sectionLabel}>Location / Place (Optional)</Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 14,
                    paddingHorizontal: 12,
                    backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "#F8FAFC",
                  }}
                >
                  <Feather name="map-pin" size={14} color={colors.primary} style={{ marginRight: 8 }} />
                  <TextInput
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      fontSize: 13,
                      color: colors.foreground,
                      fontFamily: "Inter_500Medium",
                    }}
                    value={location}
                    onChangeText={setLocation}
                    placeholder="e.g. Indiranagar, Cafe Coffee Day, Office"
                    placeholderTextColor={colors.mutedForeground}
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                    onFocus={() => {
                      setTimeout(() => {
                        scrollViewRef.current?.scrollToEnd({ animated: true });
                      }, 200);
                    }}
                  />
                </View>

                {/* Location Quick Chips */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 6, marginTop: 6, marginBottom: 4 }}
                >
                  {["Home", "Office", "Market", "Cafe", "Restaurant", "Mall", "Airport"].map((loc) => (
                    <TouchableOpacity
                      key={loc}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 8,
                        backgroundColor:
                          location === loc
                            ? colors.primary
                            : isDark
                            ? "rgba(255,255,255,0.06)"
                            : "#F1F5F9",
                      }}
                      onPress={() => {
                        safeHaptics.selectionAsync();
                        setLocation(location === loc ? "" : loc);
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontFamily: "Inter_600SemiBold",
                          color: location === loc ? "#FFFFFF" : colors.mutedForeground,
                        }}
                      >
                        {loc}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {hasSmartSuggestion && (
                  <View style={styles.smartCard}>
                    <View style={styles.smartTopRow}>
                      <View style={styles.smartIcon}>
                        <Feather name="zap" size={16} color="#FFFFFF" />
                      </View>
                      <View style={styles.smartTextWrap}>
                        <Text style={styles.smartTitle}>Smart fill available</Text>
                        <Text style={styles.smartText} numberOfLines={2}>
                          {[
                            smartDraft.amount ? `₹${smartDraft.amount.toLocaleString("en-IN")}` : null,
                            smartDraft.merchant,
                            smartDraft.categoryId ? CATEGORIES.find((cat) => cat.id === smartDraft.categoryId)?.label : null,
                            smartDraft.paymentMode ? smartDraft.paymentMode.toUpperCase() : null,
                          ].filter(Boolean).join(" · ")}
                        </Text>
                      </View>
                      <TouchableOpacity style={styles.smartApplyBtn} onPress={handleApplySmartDraft} activeOpacity={0.8}>
                        <Text style={styles.smartApplyText}>Apply</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Household Split / Personal Selector */}
                {parsedAmount > 0 && currentHousehold && (
                  <SplitExpenseSelector
                    amount={parsedAmount}
                    onSplitChange={setSplitState}
                    defaultIsHousehold={defaultIsHousehold || activeSpace === "household" || !!editExpense?.isHouseholdExpense}
                  />
                )}

                {/* Date Selection */}
                <Text style={styles.sectionLabel}>Date</Text>
                <TouchableOpacity
                  style={styles.dateRow}
                  onPress={() => {
                    safeHaptics.selectionAsync();
                    setShowCalendar(!showCalendar);
                  }}
                  activeOpacity={0.75}
                >
                  <Feather name="calendar" size={16} color={colors.primary} />
                  <Text style={styles.dateText}>{date}</Text>
                  <Feather name={showCalendar ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
                </TouchableOpacity>

                {showCalendar && (
                  <View style={{ marginTop: 12, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}>
                    <MiniCalendar
                      selectedDate={date}
                      onSelectDate={(newDate) => {
                        setDate(newDate);
                        setShowCalendar(false);
                      }}
                      getTotalForDate={getTotalForDate}
                    />
                  </View>
                )}

                {isFuture && (
                  <View style={styles.warningRow}>
                    <Feather name="alert-triangle" size={14} color="#EF4444" />
                    <Text style={styles.warningText}>Cannot log future-dated transactions.</Text>
                  </View>
                )}

                {parsedAmount > 0 && !isFuture && (
                  <View style={styles.previewCard}>
                    {inferredMerchant ? (
                      <MerchantLogo merchant={inferredMerchant} size={46} borderRadius={14} />
                    ) : (
                      <View style={styles.previewIconFallback}>
                        <Feather name={selectedCategoryMeta.icon as any} size={19} color={colors.primary} />
                      </View>
                    )}
                    <View style={styles.previewContent}>
                      <Text style={styles.previewTitle} numberOfLines={1}>
                        {inferredMerchant || selectedCategoryMeta.label}
                      </Text>
                      <Text style={styles.previewSub} numberOfLines={1}>
                        {selectedCategoryMeta.label} · {paymentMode === "none" ? "No mode" : paymentMode === "netbanking" ? "Bank" : paymentMode.toUpperCase()} · {date}
                      </Text>
                    </View>
                    <Text style={styles.previewAmount}>₹{parsedAmount.toLocaleString("en-IN")}</Text>
                  </View>
                )}
              </ScrollView>

              {/* Save CTA */}
              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  { opacity: saveDisabled ? 0.4 : 1 }
                ]}
                onPress={handleSave}
                disabled={saveDisabled}
                activeOpacity={0.85}
              >
                <Feather name={saving ? "loader" : "check"} size={18} color="#FFFFFF" />
                <Text style={styles.saveBtnText}>
                  {saving ? "Saving…" : editExpense ? "Update Spend" : `Save ₹${parsedAmount.toLocaleString("en-IN")}`}
                </Text>
              </TouchableOpacity>
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}
