import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useSubscription } from "@/context/SubscriptionContext";
import React, { useState, useRef } from "react";
import {
  Alert,
  FlatList,
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

import { useBudgets } from "@/context/BudgetContext";
import { useTheme } from "@/context/ThemeContext";
import { CATEGORIES, CategoryId, useExpenses } from "@/context/ExpenseContext";
import { useColors } from "@/hooks/useColors";
import { generateAndSharePDF, queueMonthlyStatementEmail } from "@/utils/pdfGenerator";
import { appGradients, iconSurface, surfaceStyle, bottomInset } from "@/utils/designSystem";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getLast6Months(year: number, month: number) {
  const months: { year: number; month: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    let m = month - i;
    let y = year;
    if (m <= 0) { m += 12; y -= 1; }
    months.push({ year: y, month: m });
  }
  return months;
}

function getPrevMonth(year: number, month: number) {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${d} ${MONTH_NAMES[parseInt(m, 10) - 1].substring(0, 3)} ${y}`;
}

// Projection text helper calculation inlined in render function.

export default function AnalyticsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { getCategoryTotalsForMonth, getTotalForMonth, getExpensesForMonth } = useExpenses();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [drillCategory, setDrillCategory] = useState<CategoryId | null>(null);
  const [drillPaymentMode, setDrillPaymentMode] = useState<string | null>(null);
  const [downloadingStatement, setDownloadingStatement] = useState(false);
  const [emailingStatement, setEmailingStatement] = useState(false);
  const [showStatementMonthPicker, setShowStatementMonthPicker] = useState(false);
  const isGeneratingRef = useRef(false);
  const isEmailingRef = useRef(false);

  const params = useLocalSearchParams<{ tab?: string }>();
  const [activeSegment, setActiveSegment] = useState<"charts" | "budgets">("charts");
  const { isDark } = useTheme();
  const gradients = appGradients(colors);
  const { budgets, setBudget, deleteBudget, getBudgetForCategory } = useBudgets();
  const [showSetModal, setShowSetModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | null>(null);
  const [limitInput, setLimitInput] = useState("");

  React.useEffect(() => {
    if (params.tab === "budgets") {
      setActiveSegment("budgets");
    }
  }, [params.tab]);

  const totals = getCategoryTotalsForMonth(year, month);
  const totalSpend = getTotalForMonth(year, month);
  const expensesThisMonth = getExpensesForMonth(year, month);

  const selectedMonthStr = `${year}-${String(month).padStart(2, "0")}`;
  
  const monthBudgetStatuses = React.useMemo(
    () =>
      budgets
        .filter((b) => b.month === selectedMonthStr)
        .map((b) => {
          const spent = totals[b.categoryId] || 0;
          const remaining = Math.max(0, b.monthlyLimit - spent);
          const percentage = b.monthlyLimit > 0 ? (spent / b.monthlyLimit) * 100 : 0;
          const status =
            percentage >= 100
              ? "exceeded"
              : percentage >= 80
              ? "critical"
              : percentage >= 50
              ? "warning"
              : "safe";
          return { ...b, spent, remaining, percentage, status };
        }),
    [budgets, selectedMonthStr, totals]
  );

  const sortedBudgetStatuses = React.useMemo(
    () => [...monthBudgetStatuses].sort((a, b) => b.percentage - a.percentage),
    [monthBudgetStatuses]
  );

  const handleSetBudget = async () => {
    if (!selectedCategory) return;
    const limit = parseFloat(limitInput.replace(/,/g, ""));
    if (Number.isNaN(limit) || limit <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid budget limit.");
      return;
    }
    await setBudget(selectedCategory, limit, selectedMonthStr);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    closeSetBudgetModal();
  };

  const closeSetBudgetModal = React.useCallback(() => {
    setShowSetModal(false);
    setSelectedCategory(null);
    setLimitInput("");
  }, []);

  const handleDeleteBudget = (categoryId: CategoryId) => {
    Alert.alert(
      "Remove Budget",
      "Remove this budget limit?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await deleteBudget(categoryId, selectedMonthStr);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ]
    );
  };

  const openSetModal = (categoryId: CategoryId) => {
    const existing = getBudgetForCategory(categoryId, selectedMonthStr);
    setSelectedCategory(categoryId);
    setLimitInput(existing ? String(existing.monthlyLimit) : "");
    setShowSetModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const statusColor = (status: string) => {
    if (status === "exceeded") return "#ef4444";
    if (status === "critical") return "#f59e0b";
    if (status === "warning") return "#fbbf24";
    return colors.success;
  };

  const statusBg = (status: string) => {
    if (status === "exceeded") return isDark ? "rgba(239,68,68,0.1)" : "#fee2e2";
    if (status === "critical") return isDark ? "rgba(245,158,11,0.1)" : "#fef3c7";
    if (status === "warning") return isDark ? "rgba(251,191,36,0.08)" : "#fefce8";
    return isDark ? "rgba(16,185,129,0.08)" : "#d1fae5";
  };

  const categoriesWithoutBudget = React.useMemo(
    () => {
      const categoriesWithBudget = new Set(monthBudgetStatuses.map((s) => s.categoryId));
      return CATEGORIES.filter((c) => !categoriesWithBudget.has(c.id));
    },
    [monthBudgetStatuses]
  );

  const prev = getPrevMonth(year, month);
  const prevTotalSpend = getTotalForMonth(prev.year, prev.month);

  const last6 = getLast6Months(now.getFullYear(), now.getMonth() + 1);
  const barMax = Math.max(...last6.map((m) => getTotalForMonth(m.year, m.month)), 1);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const prevMonthNav = () => {
    Haptics.selectionAsync();
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const nextMonthNav = () => {
    Haptics.selectionAsync();
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  const topCategory = CATEGORIES.find(
    (c) => totals[c.id] === Math.max(...CATEGORIES.map((x) => totals[x.id] || 0))
  );

  const trackedDaysCount = new Set(expensesThisMonth.map((e) => e.date)).size;
  const avgPerDay = trackedDaysCount > 0 ? totalSpend / trackedDaysCount : 0;
  const daysInSelectedMonth = new Date(year, month, 0).getDate();
  const noSpendDays = Math.max(daysInSelectedMonth - trackedDaysCount, 0);

  const monthChangePct =
    prevTotalSpend > 0 ? ((totalSpend - prevTotalSpend) / prevTotalSpend) * 100 : 0;
  const monthChangeLabel =
    prevTotalSpend <= 0
      ? "No previous data"
      : `${monthChangePct >= 0 ? "+" : ""}${Math.round(monthChangePct)}% vs last month`;

  const byDate: Record<string, number> = {};
  for (const e of expensesThisMonth) byDate[e.date] = (byDate[e.date] || 0) + Number(e.amount || 0);
  const peakDayEntry = Object.entries(byDate).sort((a, b) => b[1] - a[1])[0];
  const peakDayDate = peakDayEntry?.[0] || null;
  const peakDayAmount = peakDayEntry?.[1] || 0;

  const firstHalfSpend = expensesThisMonth
    .filter((e) => parseInt(e.date.split("-")[2], 10) <= 15)
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const secondHalfSpend = totalSpend - firstHalfSpend;

  const paymentModeOrder = ["upi", "card", "cash", "netbanking", "none"] as const;
  const paymentModeTotals: { key: string; label: string; amount: number }[] = paymentModeOrder.map((mode) => {
    const amount = expensesThisMonth
      .filter((e) => (e.paymentMode || "none") === mode)
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);
    return { key: mode, label: mode === "netbanking" ? "Bank" : mode.toUpperCase(), amount };
  });

  const sortedCats = [...CATEGORIES]
    .filter((cat) => (totals[cat.id] || 0) > 0)
    .sort((a, b) => (totals[b.id] || 0) - (totals[a.id] || 0));

  const drillCat = drillCategory ? CATEGORIES.find((c) => c.id === drillCategory) : null;
  const drillExpenses = drillCategory
    ? expensesThisMonth.filter((e) => e.categoryId === drillCategory).sort((a, b) => b.date.localeCompare(a.date))
    : [];
  const drillPaymentExpenses = drillPaymentMode
    ? expensesThisMonth
        .filter((e) => (e.paymentMode || "none") === drillPaymentMode)
        .sort((a, b) => b.date.localeCompare(a.date))
    : [];

  const { requirePro } = useSubscription();

  const downloadMonthlyStatement = async () => {
    if (!requirePro("Bank-Grade PDF Statements")) return;
    if (isGeneratingRef.current) return;
    if (expensesThisMonth.length === 0) {
      Alert.alert("No data", "No expenses found for this month.");
      return;
    }

    isGeneratingRef.current = true;
    setDownloadingStatement(true);
    try {
      const result = await generateAndSharePDF(
        year,
        month,
        expensesThisMonth.map((expense) => ({
          date: expense.date,
          note: expense.note,
          categoryId: expense.categoryId,
          paymentMode: expense.paymentMode,
          amount: expense.amount,
        })),
        user ? { uid: user.uid, name: user.name, email: user.email } : null
      );

      if (result === "error") {
        Alert.alert("Failed", "Could not generate the PDF statement.");
      } else if (result === "unsupported") {
        Alert.alert("Download unavailable", "Direct PDF download is only available on Android in this build.");
      }
    } catch (e) {
      console.warn("Failed to download statement:", e);
      Alert.alert("Failed", "Could not generate the PDF statement.");
    } finally {
      isGeneratingRef.current = false;
      setDownloadingStatement(false);
    }
  };

  const emailMonthlyStatement = async () => {
    if (!requirePro("Automated Email Statements")) return;
    if (isEmailingRef.current) return;
    if (expensesThisMonth.length === 0) {
      Alert.alert("No data", "No expenses found for this month.");
      return;
    }

    isEmailingRef.current = true;
    setEmailingStatement(true);
    try {
      const result = await queueMonthlyStatementEmail(
        year,
        month,
        expensesThisMonth.map((expense) => ({
          date: expense.date,
          note: expense.note,
          categoryId: expense.categoryId,
          paymentMode: expense.paymentMode,
          amount: expense.amount,
        })),
        user ? { uid: user.uid, name: user.name, email: user.email } : null
      );

      if (result === "error") return;
    } finally {
      isEmailingRef.current = false;
      setEmailingStatement(false);
    }
  };

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: topPad + 14,
      paddingBottom: 12,
      backgroundColor: colors.headerBg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    headerTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      marginBottom: 10,
    },
    headerTitle: { fontSize: 24, fontWeight: "700", fontFamily: "Inter_700Bold", color: colors.foreground },
    monthNav: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 10,
      paddingHorizontal: 16,
      marginHorizontal: 16,
      marginTop: 16,
      marginBottom: 16,
      ...surfaceStyle(colors, false),
    },
    navBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: isDark ? "rgba(56, 130, 255, 0.12)" : "rgba(0, 102, 255, 0.08)",
      alignItems: "center",
      justifyContent: "center",
    },
    monthLabel: {
      fontSize: 15,
      fontWeight: "700",
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    statementCard: {
      marginHorizontal: 16,
      padding: 16,
      marginBottom: 14,
      ...surfaceStyle(colors),
    },
    statementHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
    },
    statementIconBg: {
      width: 38,
      height: 38,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      ...iconSurface(colors),
    },
    statementTitle: {
      fontSize: 14,
      fontWeight: "700",
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    statementSubText: {
      fontSize: 11,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      marginTop: 2,
    },
    statementMonthPicker: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: isDark ? "rgba(248,250,247,0.04)" : "#F8F5EE",
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statementMonthText: {
      fontSize: 12,
      fontWeight: "600",
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    statementDownloadBtn: {
      borderRadius: 12,
      overflow: "hidden",
    },
    statementDownloadGrad: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      gap: 8,
    },
    statementDownloadText: {
      color: "#fff",
      fontFamily: "Inter_700Bold",
      fontSize: 13,
    },
    statementEmailBtn: {
      marginTop: 10,
      minHeight: 42,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark ? "rgba(248,250,247,0.04)" : "#fff",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    statementEmailText: {
      color: colors.primary,
      fontFamily: "Inter_700Bold",
      fontSize: 13,
    },
    overviewCard: {
      marginHorizontal: 16,
      marginBottom: 14,
      padding: 18,
      overflow: "hidden",
      ...surfaceStyle(colors),
    },
    overviewTopRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 14,
    },
    overviewEyebrow: {
      fontSize: 11,
      color: colors.mutedForeground,
      fontFamily: "Inter_700Bold",
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    overviewAmount: {
      fontSize: 34,
      fontWeight: "800",
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      marginTop: 6,
    },
    overviewSubtitle: {
      fontSize: 13,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      marginTop: 4,
    },
    overviewIcon: {
      width: 46,
      height: 46,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      ...iconSurface(colors, "primary"),
    },
    overviewMetrics: {
      flexDirection: "row",
      gap: 10,
      marginTop: 16,
    },
    overviewMetric: {
      flex: 1,
      borderRadius: 12,
      backgroundColor: isDark ? "rgba(248,250,252,0.04)" : colors.muted,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 10,
    },
    overviewMetricLabel: {
      fontSize: 10,
      color: colors.mutedForeground,
      fontFamily: "Inter_600SemiBold",
      textTransform: "uppercase",
      letterSpacing: 0.3,
    },
    overviewMetricValue: {
      fontSize: 14,
      color: colors.foreground,
      fontFamily: "Inter_700Bold",
      marginTop: 4,
    },
    statsRow: { flexDirection: "row", marginHorizontal: 16, gap: 10, marginBottom: 10 },
    statCard: {
      flex: 1,
      padding: 16,
      ...surfaceStyle(colors, false),
    },
    statLabel: { fontSize: 10.5, color: colors.mutedForeground, fontFamily: "Inter_600SemiBold", letterSpacing: 0.4 },
    statValue: { fontSize: 20, fontWeight: "700", fontFamily: "Inter_700Bold", color: colors.foreground, marginTop: 4 },
    statSub: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 3 },
    statSubPositive: { fontSize: 11, color: "#16a34a", fontFamily: "Inter_500Medium", marginTop: 3 },
    statSubNegative: { fontSize: 11, color: "#dc2626", fontFamily: "Inter_500Medium", marginTop: 3 },
    card: {
      marginHorizontal: 16,
      padding: 16,
      marginBottom: 14,
      ...surfaceStyle(colors),
    },
    cardTitle: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: colors.foreground, marginBottom: 14 },
    insightRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10, gap: 10 },
    insightBox: {
      flex: 1,
      backgroundColor: isDark ? "rgba(248,250,252,0.04)" : colors.muted,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    insightLabel: { fontSize: 10, color: colors.mutedForeground, fontFamily: "Inter_500Medium", letterSpacing: 0.3 },
    insightValue: { fontSize: 14, fontFamily: "Inter_700Bold", fontWeight: "700", color: colors.foreground, marginTop: 4 },
    payRow: { marginBottom: 12 },
    payTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
    payLabel: { fontSize: 12, color: colors.foreground, fontFamily: "Inter_500Medium" },
    payAmt: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
    payTrack: { height: 7, borderRadius: 4, backgroundColor: colors.muted, overflow: "hidden" },
    payFill: { height: "100%", borderRadius: 4, backgroundColor: colors.primary },
    trendBars: { flexDirection: "row", alignItems: "flex-end", gap: 8, height: 110, marginTop: 10 },
    trendBarCol: { flex: 1, alignItems: "center", gap: 6 },
    trendBar: { width: "100%" },
    trendLabel: { fontSize: 10, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    catRow: {
      flexDirection: "row", alignItems: "center", paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    },
    catIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginRight: 12 },
    catLabel: { flex: 1, fontSize: 14, fontWeight: "500", fontFamily: "Inter_500Medium", color: colors.foreground },
    catAmt: { fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold", color: colors.foreground, marginRight: 8 },
    catPct: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", width: 34, textAlign: "right" },
    barBg: { height: 4, borderRadius: 2, backgroundColor: colors.muted, marginTop: 4, marginLeft: 48 },
    scrollContent: { paddingBottom: bottomInset(insets.bottom) },
    segmentRow: {
      flexDirection: "row",
      backgroundColor: isDark ? "rgba(248,250,252,0.04)" : colors.muted,
      borderRadius: 12,
      padding: 3,
      marginHorizontal: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    segmentBtn: {
      flex: 1,
      paddingVertical: 8,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 10,
    },
    segmentBtnActive: {
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 2,
    },
    segmentBtnText: {
      fontSize: 13,
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
    },
    segmentBtnTextActive: {
      color: "#fff",
      fontFamily: "Inter_700Bold",
    },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    modalSheet: {
      backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      maxHeight: "80%",
      paddingBottom: insets.bottom + 16,
    },
    modalHandle: {
      width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2,
      alignSelf: "center", marginTop: 12, marginBottom: 4,
    },
    modalHeader: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 20, paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    },
    modalTitle: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold", color: colors.foreground },
    modalSubtitle: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 },
    expRow: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: 20, paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    },
    expNote: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: colors.foreground },
    expDate: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 },
    expAmt: { fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold", color: colors.foreground },
    emptyBudgetCard: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 32,
      marginHorizontal: 16,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: colors.text === "#f8fafc" ? 0.2 : 0.04,
      shadowRadius: 8,
      elevation: 3,
      marginBottom: 20,
    },
    emptyBudgetIcon: {
      width: 64,
      height: 64,
      borderRadius: 20,
      backgroundColor: colors.text === "#f8fafc" ? "rgba(56, 130, 255, 0.15)" : "rgba(0, 102, 255, 0.08)",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    emptyBudgetTitle: {
      fontSize: 16,
      fontWeight: "700",
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      textAlign: "center",
    },
    emptyBudgetSubtitle: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      textAlign: "center",
      marginTop: 8,
      lineHeight: 18,
      paddingHorizontal: 10,
    },
    allBudgetedCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 24,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: colors.text === "#f8fafc" ? 0.15 : 0.02,
      shadowRadius: 6,
      elevation: 2,
    },
    allBudgetedTitle: {
      fontSize: 14,
      fontWeight: "600",
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
      marginTop: 8,
    },
    allBudgetedSubtitle: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      textAlign: "center",
      marginTop: 4,
    },
  });

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={s.headerTop}>
          <Text style={s.headerTitle}>Insights</Text>
        </View>
        <View style={s.segmentRow}>
          <TouchableOpacity
            style={[s.segmentBtn, activeSegment === "charts" && s.segmentBtnActive]}
            onPress={() => { Haptics.selectionAsync(); setActiveSegment("charts"); }}
            activeOpacity={0.8}
          >
            <Text style={[s.segmentBtnText, activeSegment === "charts" && s.segmentBtnTextActive]}>
              Charts
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.segmentBtn, activeSegment === "budgets" && s.segmentBtnActive]}
            onPress={() => { Haptics.selectionAsync(); setActiveSegment("budgets"); }}
            activeOpacity={0.8}
          >
            <Text style={[s.segmentBtnText, activeSegment === "budgets" && s.segmentBtnTextActive]}>
              Budgets
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={s.monthNav}>
          <TouchableOpacity style={s.navBtn} onPress={prevMonthNav} activeOpacity={0.7}>
            <Feather name="chevron-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={s.monthLabel}>{MONTH_NAMES[month - 1]} {year}</Text>
          <TouchableOpacity style={s.navBtn} onPress={nextMonthNav} activeOpacity={0.7}>
            <Feather name="chevron-right" size={20} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        {activeSegment === "charts" ? (
          <>
            <View style={s.overviewCard}>
              <View style={s.overviewTopRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.overviewEyebrow}>Monthly Spend</Text>
                  <Text style={s.overviewAmount} numberOfLines={1} adjustsFontSizeToFit>
                    ₹{Number(totalSpend || 0).toLocaleString("en-IN")}
                  </Text>
                  <Text style={s.overviewSubtitle}>
                    {MONTH_NAMES[month - 1]} {year} · {expensesThisMonth.length} transaction{expensesThisMonth.length !== 1 ? "s" : ""}
                  </Text>
                </View>
                <View style={s.overviewIcon}>
                  <Feather name="activity" size={21} color={colors.primary} />
                </View>
              </View>

              <View style={s.overviewMetrics}>
                <View style={s.overviewMetric}>
                  <Text style={s.overviewMetricLabel}>Active Days</Text>
                  <Text style={s.overviewMetricValue}>{trackedDaysCount}</Text>
                </View>
                <View style={s.overviewMetric}>
                  <Text style={s.overviewMetricLabel}>Avg / Day</Text>
                  <Text style={s.overviewMetricValue}>
                    ₹{Number(Math.round(avgPerDay) || 0).toLocaleString("en-IN")}
                  </Text>
                </View>
                <View style={s.overviewMetric}>
                  <Text style={s.overviewMetricLabel}>No-Spend</Text>
                  <Text style={s.overviewMetricValue}>{noSpendDays}/{daysInSelectedMonth}</Text>
                </View>
              </View>

              <Text
                style={[
                  prevTotalSpend <= 0
                    ? s.statSub
                    : monthChangePct >= 0
                      ? s.statSubNegative
                      : s.statSubPositive,
                  { marginTop: 12 },
                ]}
              >
                {prevTotalSpend <= 0
                  ? "No previous month data available"
                  : `${monthChangeLabel} · Previous: ₹${Number(prevTotalSpend || 0).toLocaleString("en-IN")}`}
              </Text>
            </View>

            <View style={s.statementCard}>
              <View style={s.statementHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={s.statementIconBg}>
                    <Feather name="file-text" size={18} color={colors.primary} />
                  </View>
                  <View>
                    <Text style={s.statementTitle}>Monthly Report</Text>
                    <Text style={s.statementSubText}>Statements & reports export</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={s.statementMonthPicker}
                  activeOpacity={0.75}
                  onPress={() => setShowStatementMonthPicker(true)}
                >
                  <Text style={s.statementMonthText}>
                    {MONTH_NAMES[month - 1].substring(0, 3)} {year}
                  </Text>
                  <Feather name="chevron-down" size={12} color={colors.primary} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[s.statementDownloadBtn, downloadingStatement && { opacity: 0.75 }]}
                activeOpacity={0.8}
                disabled={downloadingStatement}
                onPress={downloadMonthlyStatement}
              >
                <LinearGradient
                  colors={gradients.action}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.statementDownloadGrad}
                >
                  <Feather name="download" size={14} color="#fff" />
                  <Text style={s.statementDownloadText}>
                    {downloadingStatement ? "Preparing Statement..." : `Download PDF Statement`}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.statementEmailBtn, emailingStatement && { opacity: 0.75 }]}
                activeOpacity={0.8}
                disabled={emailingStatement}
                onPress={emailMonthlyStatement}
              >
                <Feather name="mail" size={14} color={colors.primary} />
                <Text style={s.statementEmailText}>
                  {emailingStatement ? "Queuing Email..." : "Email Statement"}
                </Text>
              </TouchableOpacity>
            </View>

            {totalSpend > 0 && topCategory && (
              <View style={[s.statsRow, { marginBottom: 14 }]}>
                <TouchableOpacity
                  style={[s.statCard, { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }]}
                  activeOpacity={0.75}
                  onPress={() => { Haptics.selectionAsync(); setDrillCategory(topCategory.id); }}
                >
                  <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.text === "#f8fafc" ? `${topCategory.color}1c` : topCategory.lightColor, alignItems: "center", justifyContent: "center" }}>
                    <Feather name={topCategory.icon as any} size={20} color={topCategory.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.statLabel, { color: colors.mutedForeground }]}>TOP CATEGORY</Text>
                    <Text style={[s.statValue, { fontSize: 16, marginTop: 2 }]} numberOfLines={1}>{topCategory.label}</Text>
                    <Text style={s.statSub} numberOfLines={1}>
                      ₹{Number(totals[topCategory.id] || 0).toLocaleString("en-IN")} · {Math.round(((totals[topCategory.id] || 0) / totalSpend) * 100)}%
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            )}

            {/* 6-Month Trend Chart */}
            <View style={s.card}>
              <Text style={s.cardTitle}>6-Month Trend</Text>
              <View style={s.trendBars}>
                {last6.map((m, i) => {
                  const amt = getTotalForMonth(m.year, m.month);
                  const pct = barMax > 0 ? amt / barMax : 0;
                  const isCurrent = m.year === year && m.month === month;
                  return (
                    <TouchableOpacity
                      key={i}
                      style={s.trendBarCol}
                      activeOpacity={0.75}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setYear(m.year);
                        setMonth(m.month);
                      }}
                    >
                      <View style={{ flex: 1, justifyContent: "flex-end", alignItems: "center", width: "100%" }}>
                        {/* Rounded bar track */}
                        <View style={{
                          width: 18,
                          height: "100%",
                          backgroundColor: colors.text === "#f8fafc" ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.03)",
                          borderRadius: 9,
                          overflow: "hidden",
                          justifyContent: "flex-end",
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}>
                          {pct > 0 ? (
                            <LinearGradient
                              colors={isCurrent ? gradients.primary : [colors.mutedForeground + "40", colors.mutedForeground + "20"]}
                              style={{
                                height: `${Math.max(pct * 100, 10)}%`,
                                borderRadius: 9,
                              }}
                            />
                          ) : (
                            <View style={{
                              height: 6,
                              backgroundColor: colors.border,
                              borderRadius: 3,
                            }} />
                          )}
                        </View>
                      </View>
                      <Text style={[s.trendLabel, { color: isCurrent ? colors.primary : colors.mutedForeground, marginTop: 4, fontFamily: isCurrent ? "Inter_700Bold" : "Inter_400Regular" }]}>
                        {MONTH_NAMES[m.month - 1].substring(0, 3)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Spending Insights grid */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Spending Insights</Text>
              <View style={s.insightRow}>
                <View style={s.insightBox}>
                  <Text style={s.insightLabel}>PEAK SPEND DAY</Text>
                  <Text style={s.insightValue} numberOfLines={1} adjustsFontSizeToFit>
                    {peakDayDate ? `₹${peakDayAmount.toLocaleString("en-IN")}` : "₹0"}
                  </Text>
                  <Text style={s.statSub} numberOfLines={1}>{peakDayDate ? formatDate(peakDayDate) : "No spend entries"}</Text>
                </View>
                <View style={s.insightBox}>
                  <Text style={s.insightLabel}>TXN / ACTIVE DAY</Text>
                  <Text style={s.insightValue} numberOfLines={1} adjustsFontSizeToFit>
                    {trackedDaysCount > 0 ? (expensesThisMonth.length / trackedDaysCount).toFixed(1) : "0.0"}
                  </Text>
                  <Text style={s.statSub} numberOfLines={1}>Txn density score</Text>
                </View>
              </View>
              <View style={s.insightRow}>
                <View style={s.insightBox}>
                  <Text style={s.insightLabel}>1ST HALF MONTH</Text>
                  <Text style={s.insightValue} numberOfLines={1} adjustsFontSizeToFit>₹{Math.round(firstHalfSpend).toLocaleString("en-IN")}</Text>
                  <Text style={s.statSub}>Days 1 - 15</Text>
                </View>
                <View style={s.insightBox}>
                  <Text style={s.insightLabel}>2ND HALF MONTH</Text>
                  <Text style={s.insightValue} numberOfLines={1} adjustsFontSizeToFit>₹{Math.round(secondHalfSpend).toLocaleString("en-IN")}</Text>
                  <Text style={s.statSub}>Days 16 - End</Text>
                </View>
              </View>
            </View>

            {/* Payment Mode split */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Payment Mode Split</Text>
              {paymentModeTotals.filter((p) => p.amount > 0).length === 0 && (
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center", paddingVertical: 20 }}>
                  No payment data found this month
                </Text>
              )}
              {paymentModeTotals.filter((p) => p.amount > 0).map((p) => {
                const pct = totalSpend > 0 ? (p.amount / totalSpend) * 100 : 0;
                return (
                  <TouchableOpacity
                    key={p.key}
                    style={s.payRow}
                    activeOpacity={0.75}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setDrillPaymentMode(p.key);
                    }}
                  >
                    <View style={s.payTop}>
                      <Text style={s.payLabel}>{p.label}</Text>
                      <Text style={s.payAmt}>₹{Math.round(p.amount).toLocaleString("en-IN")} ({Math.round(pct)}%)</Text>
                    </View>
                    <View style={s.payTrack}>
                      <View style={[s.payFill, { width: `${pct}%` }]} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Category breakdown */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Category Breakdown</Text>
              {sortedCats.length === 0 && (
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center", paddingVertical: 20 }}>
                  No expenses this month
                </Text>
              )}
              {sortedCats.map((cat, idx) => {
                const amt = totals[cat.id] || 0;
                const pct = totalSpend > 0 ? amt / totalSpend : 0;
                const isLast = idx === sortedCats.length - 1;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    activeOpacity={0.7}
                    onPress={() => { Haptics.selectionAsync(); setDrillCategory(cat.id); }}
                    style={[s.catRow, isLast && { borderBottomWidth: 0 }]}
                  >
                    <View style={[s.catIcon, { backgroundColor: isDark ? `${cat.color}22` : `${cat.color}15` }]}>
                      <Feather name={cat.icon as any} size={18} color={cat.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <Text style={s.catLabel}>{cat.label}</Text>
                        <Text style={s.catAmt}>₹{Number(amt || 0).toLocaleString("en-IN")}</Text>
                        <Text style={s.catPct}>{Math.round(pct * 100)}%</Text>
                      </View>
                      <View style={[s.barBg, { marginLeft: 0, marginTop: 6 }]}>
                        <View style={{ height: 4, width: `${pct * 100}%`, backgroundColor: cat.color, borderRadius: 2 }} />
                      </View>
                    </View>
                    <Feather name="chevron-right" size={14} color={colors.mutedForeground} style={{ marginLeft: 8 }} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        ) : (
          <>
            {/* Budgets Summary Strip */}
            {monthBudgetStatuses.length > 0 && (
              <View
                style={{
                  flexDirection: "row",
                  marginHorizontal: 16,
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                {[
                  {
                    label: "Active Budgets",
                    value: String(monthBudgetStatuses.length),
                    icon: "target",
                  },
                  {
                    label: "On Track",
                    value: String(monthBudgetStatuses.filter((s) => s.status === "safe").length),
                    icon: "check-circle",
                    good: true,
                  },
                  {
                    label: "Exceeded",
                    value: String(monthBudgetStatuses.filter((s) => s.status === "exceeded").length),
                    icon: "alert-circle",
                    bad: true,
                  },
                ].map((item) => (
                  <View
                    key={item.label}
                    style={{
                      flex: 1,
                      backgroundColor: colors.card,
                      borderRadius: 14,
                      padding: 12,
                      alignItems: "center",
                      borderWidth: 1,
                      borderColor: colors.border,
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.04,
                      shadowRadius: 6,
                      elevation: 2,
                    }}
                  >
                    <Feather
                      name={item.icon as any}
                      size={16}
                      color={
                        item.good
                          ? colors.success
                          : item.bad
                          ? colors.destructive
                          : colors.primary
                      }
                    />
                    <Text
                      style={{
                        fontSize: 18,
                        fontFamily: "Inter_700Bold",
                        color: colors.foreground,
                        marginTop: 4,
                      }}
                    >
                      {item.value}
                    </Text>
                    <Text
                      style={{
                        fontSize: 10,
                        fontFamily: "Inter_400Regular",
                        color: colors.mutedForeground,
                        textAlign: "center",
                      }}
                    >
                      {item.label}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Empty State when no budgets exist */}
            {monthBudgetStatuses.length === 0 && (
              <View style={s.emptyBudgetCard}>
                <View style={s.emptyBudgetIcon}>
                  <Feather name="target" size={30} color={colors.primary} />
                </View>
                <Text style={s.emptyBudgetTitle}>No active budgets</Text>
                <Text style={s.emptyBudgetSubtitle}>
                  Set monthly spending limits for categories to stay on track and prevent overspending.
                </Text>
              </View>
            )}

            {/* Active Budget Cards list */}
            {monthBudgetStatuses.length > 0 && (
              <View style={{ marginHorizontal: 16, marginBottom: 20 }}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "600",
                    fontFamily: "Inter_600SemiBold",
                    color: colors.mutedForeground,
                    letterSpacing: 0.8,
                    marginBottom: 10,
                  }}
                >
                  ACTIVE BUDGETS
                </Text>

                {sortedBudgetStatuses.map((status) => {
                    const cat = CATEGORIES.find((c) => c.id === status.categoryId)!;
                    const sc = statusColor(status.status);
                    const sbg = statusBg(status.status);

                    return (
                      <View
                        key={status.id}
                        style={{
                          backgroundColor: colors.card,
                          borderRadius: 16,
                          padding: 16,
                          marginBottom: 12,
                          borderWidth: 1,
                          borderColor: status.status !== "safe" ? sc + "50" : colors.border,
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: colors.text === "#f8fafc" ? 0.15 : 0.02,
                          shadowRadius: 6,
                          elevation: 2,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            marginBottom: 12,
                          }}
                        >
                          <View
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: 12,
                              backgroundColor: cat.color + "20",
                              alignItems: "center",
                              justifyContent: "center",
                              marginRight: 12,
                            }}
                          >
                            <Feather name={cat.icon as any} size={18} color={cat.color} />
                          </View>

                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                fontSize: 15,
                                fontFamily: "Inter_600SemiBold",
                                color: colors.foreground,
                              }}
                            >
                              {cat.label}
                            </Text>
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 6,
                                marginTop: 2,
                              }}
                            >
                              <View
                                style={{
                                  paddingHorizontal: 7,
                                  paddingVertical: 2,
                                  borderRadius: 6,
                                  backgroundColor: sbg,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 11,
                                    fontFamily: "Inter_600SemiBold",
                                    color: sc,
                                  }}
                                >
                                  {status.status === "exceeded"
                                    ? "Exceeded"
                                    : status.status === "critical"
                                    ? "Critical"
                                    : status.status === "warning"
                                    ? "Warning"
                                    : "On Track"}
                                </Text>
                              </View>
                              <Text
                                style={{
                                  fontSize: 11,
                                  color: colors.mutedForeground,
                                  fontFamily: "Inter_400Regular",
                                }}
                              >
                                {Math.round(status.percentage)}% used
                              </Text>
                            </View>
                          </View>

                          <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 8 }}>
                            <TouchableOpacity
                              onPress={() => openSetModal(status.categoryId)}
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: 8,
                                backgroundColor: colors.text === "#f8fafc" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Feather name="edit-2" size={13} color={colors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleDeleteBudget(status.categoryId)}
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: 8,
                                backgroundColor: colors.text === "#f8fafc" ? "rgba(239,68,68,0.1)" : "#fee2e2",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Feather name="trash-2" size={13} color="#ef4444" />
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Progress Bar */}
                        <View
                          style={{
                            height: 8,
                            backgroundColor: colors.muted,
                            borderRadius: 4,
                            overflow: "hidden",
                            marginBottom: 8,
                          }}
                        >
                          <View
                            style={{
                              height: "100%",
                              width: `${Math.min(100, status.percentage)}%`,
                              backgroundColor: sc,
                              borderRadius: 4,
                            }}
                          />
                        </View>

                        {/* Amount row */}
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <Text
                            style={{
                              fontSize: 13,
                              fontFamily: "Inter_500Medium",
                              color: colors.foreground,
                            }}
                          >
                            ₹{status.spent.toLocaleString("en-IN")} spent
                          </Text>
                          <Text
                            style={{
                              fontSize: 13,
                              fontFamily: "Inter_400Regular",
                              color: colors.mutedForeground,
                            }}
                          >
                            of ₹{status.monthlyLimit.toLocaleString("en-IN")}
                          </Text>
                        </View>

                        {/* Inline ProjectionText render logic */}
                        {(() => {
                          if (status.percentage < 50) return null;
                          const now = new Date();
                          const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                          const dayOfMonth = now.getDate();
                          const dailyRate = status.spent / dayOfMonth;
                          const projectedTotal = dailyRate * daysInMonth;
                          const overshoot = projectedTotal - status.monthlyLimit;

                          if (overshoot <= 0) return null;

                          return (
                            <Text style={{ fontSize: 11, color: colors.warning, fontFamily: "Inter_500Medium", marginTop: 6 }}>
                              📈 At this rate, you'll overspend by ₹{Math.round(overshoot).toLocaleString("en-IN")}
                            </Text>
                          );
                        })()}
                      </View>
                    );
                  })}
              </View>
            )}

            {/* Add Budget */}
            <View style={{ marginHorizontal: 16, marginBottom: 24 }}>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  fontFamily: "Inter_600SemiBold",
                  color: colors.mutedForeground,
                  letterSpacing: 0.8,
                  marginBottom: 10,
                }}
              >
                {monthBudgetStatuses.length > 0 ? "ADD MORE BUDGETS" : "SET YOUR FIRST BUDGET"}
              </Text>

              {categoriesWithoutBudget.length > 0 ? (
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: colors.border,
                    overflow: "hidden",
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: colors.text === "#f8fafc" ? 0.1 : 0.01,
                    shadowRadius: 4,
                    elevation: 1,
                  }}
                >
                  {categoriesWithoutBudget.map((cat, index) => (
                    <React.Fragment key={cat.id}>
                      {index > 0 && (
                        <View
                          style={{
                            height: 1,
                            backgroundColor: colors.border,
                            marginHorizontal: 16,
                          }}
                        />
                      )}
                      <TouchableOpacity
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          paddingVertical: 12,
                          paddingHorizontal: 16,
                          gap: 12,
                        }}
                        onPress={() => openSetModal(cat.id)}
                        activeOpacity={0.7}
                      >
                        <View
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 10,
                            backgroundColor: cat.color + "18",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Feather name={cat.icon as any} size={16} color={cat.color} />
                        </View>
                        <Text
                          style={{
                            flex: 1,
                            fontSize: 14,
                            fontFamily: "Inter_500Medium",
                            color: colors.foreground,
                          }}
                        >
                          {cat.label}
                        </Text>
                        <Feather name="plus-circle" size={18} color={colors.primary} />
                      </TouchableOpacity>
                    </React.Fragment>
                  ))}
                </View>
              ) : (
                <View style={s.allBudgetedCard}>
                  <View style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: colors.text === "#f8fafc" ? "rgba(16, 185, 129, 0.15)" : "rgba(16, 185, 129, 0.08)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    <Feather name="check" size={20} color={colors.success} />
                  </View>
                  <Text style={s.allBudgetedTitle}>All Categories Budgeted</Text>
                  <Text style={s.allBudgetedSubtitle}>
                    You have set budget limits for all categories this month!
                  </Text>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Set Budget Modal */}
      <Modal
        visible={showSetModal}
        transparent
        animationType="slide"
        onRequestClose={closeSetBudgetModal}
      >
        <Pressable style={s.modalOverlay} onPress={closeSetBudgetModal}>
          <View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              paddingBottom: Platform.OS === "ios" ? insets.bottom + 24 : 24,
            }}
            onStartShouldSetResponder={() => true}
          >
            {selectedCategory && (() => {
              const cat = CATEGORIES.find((c) => c.id === selectedCategory)!;
              return (
                <>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 }}>
                    <View
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 13,
                        backgroundColor: cat.color + "20",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Feather name={cat.icon as any} size={20} color={cat.color} />
                    </View>
                    <View>
                      <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: colors.foreground }}>
                        {cat.label} Budget
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>
                        Set monthly limit for {MONTH_NAMES[month - 1]} {year}
                      </Text>
                    </View>
                  </View>

                  <Text style={{ fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_500Medium", marginBottom: 8 }}>
                    Monthly Limit (₹)
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: colors.input,
                      borderRadius: 12,
                      paddingHorizontal: 14,
                      borderWidth: 1.5,
                      borderColor: colors.border,
                      marginBottom: 20,
                    }}
                  >
                    <Text style={{ fontSize: 18, color: colors.primary, fontFamily: "Inter_600SemiBold", marginRight: 8 }}>₹</Text>
                    <TextInput
                      value={limitInput}
                      onChangeText={setLimitInput}
                      keyboardType="numeric"
                      placeholder="5000"
                      placeholderTextColor={colors.mutedForeground}
                      style={{
                        flex: 1,
                        fontSize: 20,
                        fontFamily: "Inter_600SemiBold",
                        color: colors.foreground,
                        paddingVertical: 14,
                      }}
                    />
                  </View>

                  <TouchableOpacity
                    onPress={handleSetBudget}
                    activeOpacity={0.85}
                    style={{ borderRadius: 14, overflow: "hidden" }}
                  >
                    <LinearGradient
                      colors={gradients.primary}
                      style={{
                        paddingVertical: 16,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" }}>
                        Set Budget
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              );
            })()}
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={showStatementMonthPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowStatementMonthPicker(false)}
      >
        <Pressable style={s.modalOverlay} onPress={() => setShowStatementMonthPicker(false)}>
          <Pressable style={[s.modalSheet, { maxHeight: "72%" }]} onPress={(e) => e.stopPropagation()}>
            <View style={s.modalHandle} />
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>Select Statement Month</Text>
                <Text style={s.modalSubtitle}>You can download for any month immediately</Text>
              </View>
              <TouchableOpacity onPress={() => setShowStatementMonthPicker(false)}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={last6.slice().reverse()}
              keyExtractor={(item) => `${item.year}-${item.month}`}
              renderItem={({ item }) => {
                const selected = item.year === year && item.month === month;
                return (
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setYear(item.year);
                      setMonth(item.month);
                      setShowStatementMonthPicker(false);
                    }}
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 14,
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: colors.border,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 15 }}>
                      {MONTH_NAMES[item.month - 1]} {item.year}
                    </Text>
                    {selected && <Feather name="check" size={16} color={colors.primary} />}
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={!!drillCategory}
        animationType="slide"
        transparent
        onRequestClose={() => setDrillCategory(null)}
      >
        <Pressable style={s.modalOverlay} onPress={() => setDrillCategory(null)}>
          <Pressable style={[s.modalSheet, { flexShrink: 1 }]} onPress={(e) => e.stopPropagation()}>
            <View style={s.modalHandle} />
            <View style={s.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                {drillCat && (
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.text === "#f8fafc" ? `${drillCat.color}1c` : drillCat.lightColor, alignItems: "center", justifyContent: "center" }}>
                    <Feather name={drillCat.icon as any} size={18} color={drillCat.color} />
                  </View>
                )}
                <View>
                  <Text style={s.modalTitle}>{drillCat?.label}</Text>
                  <Text style={s.modalSubtitle}>
                    ₹{(totals[drillCategory!] || 0).toLocaleString("en-IN")} · {drillExpenses.length} transactions
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setDrillCategory(null)}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <FlatList
              style={{ flexShrink: 1 }}
              data={drillExpenses}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={true}
              initialNumToRender={15}
              maxToRenderPerBatch={10}
              windowSize={5}
              ListEmptyComponent={
                <Text style={{ color: colors.mutedForeground, textAlign: "center", padding: 32, fontFamily: "Inter_400Regular" }}>No expenses</Text>
              }
              renderItem={({ item: exp }) => (
                <View style={s.expRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.expNote}>{exp.note || drillCat?.label}</Text>
                    <Text style={s.expDate}>{formatDate(exp.date)}</Text>
                  </View>
                  <Text style={[s.expAmt, { color: drillCat?.color }]}>
                    ₹{Number(exp.amount || 0).toLocaleString("en-IN")}
                  </Text>
                </View>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={!!drillPaymentMode}
        animationType="slide"
        transparent
        onRequestClose={() => setDrillPaymentMode(null)}
      >
        <Pressable style={s.modalOverlay} onPress={() => setDrillPaymentMode(null)}>
          <Pressable style={[s.modalSheet, { flexShrink: 1 }]} onPress={(e) => e.stopPropagation()}>
            <View style={s.modalHandle} />
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>
                  {(drillPaymentMode || "").toUpperCase() === "NETBANKING"
                    ? "Bank"
                    : (drillPaymentMode || "NONE").toUpperCase()}
                </Text>
                <Text style={s.modalSubtitle}>
                  ₹{paymentModeTotals.find((x) => x.key === drillPaymentMode)?.amount.toLocaleString("en-IN") || "0"} · {drillPaymentExpenses.length} transactions
                </Text>
              </View>
              <TouchableOpacity onPress={() => setDrillPaymentMode(null)}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <FlatList
              style={{ flexShrink: 1 }}
              data={drillPaymentExpenses}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={true}
              initialNumToRender={15}
              maxToRenderPerBatch={10}
              windowSize={5}
              ListEmptyComponent={
                <Text style={{ color: colors.mutedForeground, textAlign: "center", padding: 32, fontFamily: "Inter_400Regular" }}>No expenses</Text>
              }
              renderItem={({ item: exp }) => (
                <View style={s.expRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.expNote}>{exp.note || "Expense"}</Text>
                    <Text style={s.expDate}>{formatDate(exp.date)}</Text>
                  </View>
                  <Text style={s.expAmt}>
                    ₹{Number(exp.amount || 0).toLocaleString("en-IN")}
                  </Text>
                </View>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
