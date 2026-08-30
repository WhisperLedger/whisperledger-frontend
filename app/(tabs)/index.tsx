import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { safeHaptics } from "@/utils/haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { collection, onSnapshot, query, where } from "firebase/firestore";

import AddExpenseModal from "@/components/AddExpenseModal";
import AddReceivableModal from "@/components/AddReceivableModal";
import ReceivablesSummaryCard from "@/components/ReceivablesSummaryCard";
import ExpenseItem from "@/components/ExpenseItem";
import { useAuth } from "@/context/AuthContext";
import { CATEGORIES, CategoryId, Expense, useExpenses } from "@/context/ExpenseContext";
import { useColors } from "@/hooks/useColors";
import { db } from "@/lib/firebase";
import { appGradients, bottomInset, iconSurface, isDarkPalette, surfaceStyle } from "@/utils/designSystem";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
}

function getWeekDates() {
  const today = new Date();
  const week: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    week.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    );
  }
  return week;
}

const WEEK_DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getExpensesForDate, getTotalForDate } = useExpenses();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ openAdd?: string }>();

  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [showAdd, setShowAdd] = useState(false);
  const [showAddReceivable, setShowAddReceivable] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const today = todayISO();
  const weekDates = getWeekDates();
  const dailyExpenses = getExpensesForDate(selectedDate);
  const dailyTotal = getTotalForDate(selectedDate);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = bottomInset(insets.bottom);
  const isDark = isDarkPalette(colors);
  const gradients = appGradients(colors);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, `users/${user.uid}/notifications`), where("read", "==", false));
    const unsub = onSnapshot(q, {
      next: (snap) => {
        const unreadNotifs = snap.docs.map((d) => d.data() as any);
        const filteredCount = unreadNotifs.filter(
          (x) => x.notificationType !== "daily_reminder" && x.notificationType !== "budget_alert"
        ).length;
        setUnreadCount(filteredCount);
      },
      error: (err) => {
        console.warn("⚠️ Unread notifications snapshot failed (likely permission-denied/offline):", err);
      }
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    if (params.openAdd === "1" || params.openAdd === "true") {
      setEditExpense(null);
      setShowAdd(true);
      router.replace("/");
    }
  }, [params.openAdd]);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    gradHeader: {
      paddingTop: topPad + 16,
      paddingHorizontal: 20,
      paddingBottom: 26,
    },
    greetRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 20,
    },
    greeting: {
      fontSize: 14,
      color: isDark ? "rgba(248,250,247,0.72)" : colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: "700" as const,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    totalWrap: {
      padding: 18,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      ...surfaceStyle(colors),
    },
    totalLabel: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_500Medium",
      letterSpacing: 0.4,
    },
    totalDate: {
      fontSize: 13,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      marginTop: 2,
    },
    totalAmount: {
      fontSize: 32,
      fontWeight: "700" as const,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      marginTop: 4,
    },
    countBubble: {
      backgroundColor: isDark ? "rgba(45, 212, 191, 0.12)" : "#E8F3EF",
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    countText: {
      fontSize: 14,
      fontWeight: "600" as const,
      fontFamily: "Inter_600SemiBold",
      color: colors.primary,
    },
    weekStrip: {
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingVertical: 12,
    },
    dayBtn: {
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 12,
      marginHorizontal: 4,
      borderWidth: 1,
    },
    dayLabel: {
      fontSize: 10,
      fontFamily: "Inter_500Medium",
      fontWeight: "500" as const,
    },
    dayNum: {
      fontSize: 18,
      fontFamily: "Inter_700Bold",
      fontWeight: "700" as const,
      marginTop: 2,
    },
    dayDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      marginTop: 3,
    },
    sectionHeader: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: "600" as const,
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
      letterSpacing: 0.4,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: bottomPad,
    },
    emptyWrap: {
      alignItems: "center",
      paddingTop: 60,
      paddingHorizontal: 32,
    },
    emptyIcon: {
      width: 72,
      height: 72,
      borderRadius: 22,
      backgroundColor: colors.muted,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 14,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: "600" as const,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
      textAlign: "center",
    },
    emptySubtitle: {
      fontSize: 13,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      textAlign: "center",
      marginTop: 6,
      lineHeight: 20,
    },
    fab: {
      position: "absolute",
      right: 20,
      bottom: Platform.OS === "web" ? 34 + 84 : Platform.select({ ios: 84 + 8, default: 64 + 8 }),
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 10,
      elevation: 6,
    },
    notifyBtn: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      ...iconSurface(colors),
    },
    notifyBadge: {
      position: "absolute",
      right: -4,
      top: -4,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      paddingHorizontal: 4,
      backgroundColor: "#ef4444",
      alignItems: "center",
      justifyContent: "center",
    },
    notifyBadgeText: {
      color: "#fff",
      fontSize: 10,
      fontFamily: "Inter_700Bold",
      fontWeight: "700" as const,
    },
  });

  const firstName = user?.name?.split(" ")[0] || "there";

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={gradients.hero}
        style={styles.gradHeader}
      >
        <View style={styles.greetRow}>
          <View>
            <Text style={styles.greeting}>Good day, {firstName}</Text>
            <Text style={styles.headerTitle}>Daily Tracker</Text>
          </View>
          <TouchableOpacity
            style={styles.notifyBtn}
            activeOpacity={0.8}
            onPress={() => router.push("/notifications")}
          >
            <Feather name="bell" size={20} color={colors.foreground} />
            {unreadCount > 0 && (
              <View style={styles.notifyBadge}>
                <Text style={styles.notifyBadgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.totalWrap}>
          <View>
            <Text style={styles.totalLabel}>TOTAL SPENT</Text>
            <Text style={styles.totalDate}>{formatDate(selectedDate)}</Text>
            <Text style={styles.totalAmount}>₹{dailyTotal.toLocaleString("en-IN")}</Text>
          </View>
          <View style={styles.countBubble}>
            <Text style={styles.countText}>{dailyExpenses.length} items</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Money Recovery Hero Card */}
      <ReceivablesSummaryCard onOpenAdd={() => setShowAddReceivable(true)} />

      {/* Week Strip */}
      <View style={styles.weekStrip}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 8 }}>
          {weekDates.map((iso) => {
            const [, , d] = iso.split("-").map(Number);
            const dayOfWeek = new Date(iso).getDay();
            const isSelected = iso === selectedDate;
            const isToday = iso === today;
            const hasSpend = getTotalForDate(iso) > 0;

            return (
              <TouchableOpacity
                key={iso}
                style={[
                  styles.dayBtn,
                  isSelected
                    ? {
                        backgroundColor: colors.primary,
                        borderColor: isDark ? "rgba(248, 250, 247, 0.16)" : "rgba(15, 118, 110, 0.20)",
                        shadowColor: colors.primary,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.18,
                        shadowRadius: 6,
                        elevation: 3,
                      }
                    : {
                        backgroundColor: isDark ? "rgba(248, 250, 247, 0.03)" : "#FFFFFF",
                        borderColor: colors.border,
                      },
                ]}
                onPress={() => { setSelectedDate(iso); safeHaptics.selectionAsync(); }}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.dayLabel,
                    { color: isSelected ? "rgba(255,255,255,0.8)" : colors.mutedForeground },
                  ]}
                >
                  {WEEK_DAYS[dayOfWeek]}
                </Text>
                <Text
                  style={[
                    styles.dayNum,
                    { color: isSelected ? "#fff" : isToday ? colors.primary : colors.foreground },
                  ]}
                >
                  {d}
                </Text>
                <View
                  style={[
                    styles.dayDot,
                    {
                      backgroundColor: hasSpend
                        ? isSelected ? "rgba(255,255,255,0.7)" : colors.primary
                        : "transparent",
                    },
                  ]}
                />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={dailyExpenses}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          dailyExpenses.length > 0 ? (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>TRANSACTIONS</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Feather name="inbox" size={28} color={colors.mutedForeground} />
            </View>
            <Text style={styles.emptyTitle}>No expenses today</Text>
            <Text style={styles.emptySubtitle}>
              Tap the + button to log your first expense for this day
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <ExpenseItem
            expense={item}
            onEdit={(exp) => { setEditExpense(exp); setShowAdd(true); }}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          setEditExpense(null);
          setShowAdd(true);
          safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={gradients.action}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 28,
            alignItems: "center",
            justifyContent: "center",
          }}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Feather name="plus" size={28} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>

      <AddExpenseModal
        visible={showAdd}
        onClose={() => { setShowAdd(false); setEditExpense(null); }}
        defaultDate={selectedDate}
        editExpense={editExpense}
      />

      <AddReceivableModal
        visible={showAddReceivable}
        onClose={() => setShowAddReceivable(false)}
      />
    </View>
  );
}
