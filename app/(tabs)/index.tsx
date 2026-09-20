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
import HouseholdSpaceHeader from "@/components/HouseholdSpaceHeader";
import HouseholdBalanceCard from "@/components/HouseholdBalanceCard";
import HouseholdExpenseItem from "@/components/HouseholdExpenseItem";
import SettleUpModal from "@/components/SettleUpModal";
import HouseholdManagementModal from "@/components/HouseholdManagementModal";
import QuickActionMenu from "@/components/QuickActionMenu";
import ProBadge from "@/components/ProBadge";
import { useAuth } from "@/context/AuthContext";
import { CATEGORIES, CategoryId, Expense, useExpenses } from "@/context/ExpenseContext";
import { useHousehold } from "@/context/HouseholdContext";
import { useSubscription } from "@/context/SubscriptionContext";
import { DebtSummary, HouseholdExpense } from "@/types/household";
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
  const { isPro } = useSubscription();
  const {
    activeSpace,
    currentHousehold,
    householdExpenses,
    pendingSplits,
    acceptSplit,
    declineSplit,
  } = useHousehold();
  const params = useLocalSearchParams<{ openAdd?: string; date?: string }>();

  const [selectedDate, setSelectedDate] = useState(params.date || todayISO());
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [isHouseholdSpend, setIsHouseholdSpend] = useState(false);
  const [showAddReceivable, setShowAddReceivable] = useState(false);
  const [showSettleUp, setShowSettleUp] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<DebtSummary | null>(null);
  const [showHouseholdManage, setShowHouseholdManage] = useState(false);
  const [editExpense, setEditExpense] = useState<any | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const today = todayISO();
  const weekDates = getWeekDates();
  const dailyExpenses = getExpensesForDate(selectedDate);
  const dailyTotal = getTotalForDate(selectedDate);

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const householdMonthExpenses = (householdExpenses || []).filter(
    (e) => e?.date && e.date.startsWith(currentMonthStr) && !e.isSettlement
  );
  const householdMonthTotal = householdMonthExpenses.reduce(
    (sum, e) => sum + Number(e.amount || 0),
    0
  );

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
    if (params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)) {
      setSelectedDate(params.date);
    }
    if (params.openAdd === "1" || params.openAdd === "true") {
      setEditExpense(null);
      setShowAdd(true);
      router.replace(params.date ? `/?date=${params.date}` : "/");
    }
  }, [params.openAdd, params.date]);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    gradHeader: {
      paddingTop: topPad + 14,
      paddingHorizontal: 20,
      paddingBottom: 18,
    },
    greetRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 14,
    },
    greeting: {
      fontSize: 13,
      color: colors.mutedForeground,
      fontFamily: "Inter_500Medium",
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: "700" as const,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    notifyBtn: {
      ...iconSurface(colors),
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
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
    totalWrap: {
      ...surfaceStyle(colors, true),
      padding: 18,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderRadius: 20,
      marginTop: 6,
    },
    totalLabel: {
      fontSize: 11.5,
      color: colors.mutedForeground,
      fontFamily: "Inter_600SemiBold",
      letterSpacing: 0.6,
      textTransform: "uppercase",
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
      backgroundColor: isDark ? "rgba(56, 130, 255, 0.15)" : "#F0F7FF",
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderWidth: 1,
      borderColor: isDark ? "rgba(56, 130, 255, 0.3)" : "rgba(0, 102, 255, 0.2)",
    },
    countText: {
      fontSize: 13,
      fontWeight: "600" as const,
      fontFamily: "Inter_600SemiBold",
      color: colors.primary,
    },
    weekStrip: {
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingVertical: 10,
    },
    dayBtn: {
      alignItems: "center",
      paddingHorizontal: 15,
      paddingVertical: 8,
      borderRadius: 14,
      marginHorizontal: 4,
      borderWidth: 1,
    },
    dayLabel: {
      fontSize: 10,
      fontFamily: "Inter_500Medium",
      fontWeight: "500" as const,
    },
    dayNum: {
      fontSize: 17,
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
      fontSize: 13,
      fontWeight: "700" as const,
      fontFamily: "Inter_700Bold",
      color: colors.mutedForeground,
      letterSpacing: 0.6,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: Platform.select({ ios: 100, default: 84 }),
    },
    emptyWrap: {
      alignItems: "center",
      paddingTop: 48,
      paddingHorizontal: 32,
    },
    emptyIcon: {
      ...iconSurface(colors),
      width: 68,
      height: 68,
      borderRadius: 22,
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
      bottom: Platform.select({ ios: 94, default: 74 }),
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      overflow: "hidden",
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 10,
      elevation: 6,
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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={styles.greeting}>Good day, {firstName}</Text>
              {isPro && <ProBadge size="sm" />}
            </View>
            <Text style={styles.headerTitle}>
              {activeSpace === "household" ? "Household Ledger" : "Daily Tracker"}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.notifyBtn}
            activeOpacity={0.8}
            onPress={() => router.push("/notifications")}
          >
            <Feather name="bell" size={20} color={colors.primary} />
            {unreadCount > 0 && (
              <View style={styles.notifyBadge}>
                <Text style={styles.notifyBadgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Space Switcher Pill */}
        <HouseholdSpaceHeader onOpenHouseholdManage={() => setShowHouseholdManage(true)} />

        {activeSpace === "household" ? (
          <View style={styles.totalWrap}>
            <View>
              <Text style={styles.totalLabel}>TOTAL FLAT SPEND THIS MONTH</Text>
              <Text style={styles.totalDate}>
                {new Date().toLocaleString("default", { month: "long", year: "numeric" })}
              </Text>
              <Text style={styles.totalAmount}>₹{householdMonthTotal.toLocaleString("en-IN")}</Text>
            </View>
            <View style={styles.countBubble}>
              <Text style={styles.countText}>{householdMonthExpenses.length} spends</Text>
            </View>
          </View>
        ) : (
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
        )}
      </LinearGradient>

      {activeSpace === "personal" ? (
        <>
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
                            borderColor: isDark ? "rgba(248, 250, 252, 0.16)" : "rgba(0, 102, 255, 0.20)",
                            shadowColor: colors.primary,
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.18,
                            shadowRadius: 6,
                            elevation: 3,
                          }
                        : {
                            backgroundColor: colors.card,
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
        </>
      ) : (
        /* HOUSEHOLD SPACE VIEW */
        <FlatList
          data={householdExpenses}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View style={{ paddingTop: 14 }}>
              <HouseholdBalanceCard
                onManagePress={() => setShowHouseholdManage(true)}
                onSettleDebt={(debt) => {
                  setSelectedDebt(debt || null);
                  setShowSettleUp(true);
                }}
              />

              {/* Pending Split Requests for User Approval */}
              {pendingSplits.length > 0 && (
                <View
                  style={{
                    marginHorizontal: 16,
                    marginTop: 12,
                    padding: 14,
                    borderRadius: 18,
                    backgroundColor: isDark ? "rgba(245, 158, 11, 0.12)" : "#FEF3C7",
                    borderWidth: 1,
                    borderColor: isDark ? "rgba(245, 158, 11, 0.25)" : "#FDE68A",
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
                    <Feather name="clock" size={14} color="#D97706" />
                    <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: "#D97706", letterSpacing: 0.6 }}>
                      {pendingSplits.length} PENDING SPLIT REQUEST{pendingSplits.length > 1 ? "S" : ""}
                    </Text>
                  </View>

                  {pendingSplits.map(({ expense, split }) => (
                    <View
                      key={expense.id}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingVertical: 8,
                        borderTopWidth: 1,
                        borderTopColor: isDark ? "rgba(245, 158, 11, 0.2)" : "#FDE68A",
                        gap: 10,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground }} numberOfLines={1}>
                          {expense.note || "Shared Spend"}
                        </Text>
                        <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
                          {expense.payerName} paid ₹{expense.amount} · Your share: <Text style={{ fontFamily: "Inter_700Bold", color: colors.primary }}>₹{split.share}</Text>
                        </Text>
                      </View>

                      <View style={{ flexDirection: "row", gap: 6 }}>
                        <TouchableOpacity
                          style={{
                            backgroundColor: colors.primary,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 8,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                          }}
                          onPress={() => {
                            safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            acceptSplit(expense.id);
                          }}
                        >
                          <Feather name="check" size={12} color="#FFFFFF" />
                          <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: "#FFFFFF" }}>Accept</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={{
                            backgroundColor: isDark ? "rgba(239, 68, 68, 0.15)" : "#FEE2E2",
                            paddingHorizontal: 8,
                            paddingVertical: 6,
                            borderRadius: 8,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                          onPress={() => {
                            safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            declineSplit(expense.id);
                          }}
                        >
                          <Feather name="x" size={12} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Household Feature Category Shortcuts */}
              <View style={{ marginHorizontal: 16, marginTop: 12, marginBottom: 6 }}>
                <Text style={styles.sectionTitle}>FLAT QUICK SPLIT</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 6 }}>
                  {[
                    { label: "Maid / Cook", icon: "user-check", cat: "maid_cook" as CategoryId },
                    { label: "Rent & Bills", icon: "home", cat: "rent" as CategoryId },
                    { label: "Groceries", icon: "shopping-cart", cat: "groceries" as CategoryId },
                    { label: "Wifi / Power", icon: "wifi", cat: "bills" as CategoryId },
                  ].map((item) => (
                    <TouchableOpacity
                      key={item.cat}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        borderRadius: 12,
                        backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#F1F5F9",
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                      onPress={() => {
                        safeHaptics.selectionAsync();
                        setEditExpense({
                          categoryId: item.cat,
                          note: item.label,
                          isHouseholdExpense: true,
                        });
                        setShowAdd(true);
                      }}
                    >
                      <Feather name={item.icon as any} size={13} color={colors.primary} />
                      <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {householdExpenses.length > 0 && (
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>HOUSEHOLD SPENDS & SETTLEMENTS</Text>
                </View>
              )}
            </View>
          }
          ListEmptyComponent={
            currentHousehold ? (
              <View style={styles.emptyWrap}>
                <View style={styles.emptyIcon}>
                  <Feather name="coffee" size={28} color={colors.mutedForeground} />
                </View>
                <Text style={styles.emptyTitle}>No shared household spends</Text>
                <Text style={styles.emptySubtitle}>
                  Tap the + button to add a bill or grocery spend to split with flatmates
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <HouseholdExpenseItem
              expense={item}
              onEdit={(exp) => {
                setEditExpense({
                  ...exp,
                  isHouseholdExpense: true,
                });
                setShowAdd(true);
              }}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setEditExpense(null);
          setIsHouseholdSpend(activeSpace === "household");
          setShowAdd(true);
        }}
        activeOpacity={0.85}
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

      <QuickActionMenu
        visible={showQuickActions}
        onClose={() => setShowQuickActions(false)}
        hasHousehold={!!currentHousehold}
        onSelectPersonalExpense={() => {
          setEditExpense(null);
          setIsHouseholdSpend(false);
          setShowAdd(true);
        }}
        onSelectHouseholdSplit={() => {
          setEditExpense(null);
          setIsHouseholdSpend(true);
          setShowAdd(true);
        }}
        onSelectReceivable={() => {
          setShowAddReceivable(true);
        }}
        onSelectSettleUp={() => {
          setSelectedDebt(null);
          setShowSettleUp(true);
        }}
      />

      <AddExpenseModal
        visible={showAdd}
        onClose={() => { setShowAdd(false); setEditExpense(null); }}
        defaultDate={selectedDate}
        editExpense={editExpense}
        defaultIsHousehold={isHouseholdSpend || activeSpace === "household"}
      />

      <AddReceivableModal
        visible={showAddReceivable}
        onClose={() => setShowAddReceivable(false)}
      />

      <SettleUpModal
        visible={showSettleUp}
        onClose={() => {
          setShowSettleUp(false);
          setSelectedDebt(null);
        }}
        preselectedDebt={selectedDebt}
      />

      <HouseholdManagementModal
        visible={showHouseholdManage}
        onClose={() => setShowHouseholdManage(false)}
      />
    </View>
  );
}
