import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import AddReceivableModal from "@/components/AddReceivableModal";
import ReceivableItemCard from "@/components/ReceivableItemCard";
import RecoveryDetailModal from "@/components/RecoveryDetailModal";
import { useReceivables } from "@/context/ReceivablesContext";
import { useColors } from "@/hooks/useColors";
import type { Receivable, ReceivableCategory } from "@/types/receivable";
import { CATEGORY_LABELS } from "@/types/receivable";
import { safeHaptics } from "@/utils/haptics";
import { exportReceivablesToCSV } from "@/utils/exportHelper";

export default function MoneyRecoveryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { receivables, getPendingReceivables, getTotalPendingAmount, getTotalRecoveredAmount } = useReceivables();

  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedReceivable, setSelectedReceivable] = useState<Receivable | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const pendingAmount = getTotalPendingAmount();
  const recoveredAmount = getTotalRecoveredAmount();
  const pendingList = getPendingReceivables();

  // Filter items by category and search query
  const filteredList = receivables.filter((r) => {
    const matchesCategory =
      selectedCategory === "ALL"
        ? r.status !== "RECOVERED" && r.status !== "CANCELLED"
        : selectedCategory === "RECOVERED"
        ? r.status === "RECOVERED"
        : r.category === selectedCategory;

    if (!matchesCategory) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (r.merchant && r.merchant.toLowerCase().includes(q)) ||
      (r.orderId && r.orderId.toLowerCase().includes(q)) ||
      (r.notes && r.notes.toLowerCase().includes(q)) ||
      r.amount.toString().includes(q)
    );
  });

  const handleCardPress = (r: Receivable) => {
    setSelectedReceivable(r);
    setShowDetailModal(true);
  };

  const handleExportCSV = () => {
    safeHaptics.selectionAsync();
    exportReceivablesToCSV(receivables);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => {
            safeHaptics.selectionAsync();
            router.back();
          }}
        >
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Money Recovery Hub</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            Post-purchase Money Recovery Agent
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: "rgba(99, 102, 241, 0.15)", marginRight: 8 }]}
          onPress={handleExportCSV}
        >
          <Feather name="download" size={18} color="#6366f1" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: "#6366f1" }]}
          onPress={() => {
            safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowAddModal(true);
          }}
        >
          <Feather name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Summary Cards Row */}
      <View style={styles.statsRow}>
        <LinearGradient
          colors={colors.text === "#f8fafc" ? ["#1e1b4b", "#0f172a"] : ["#EEF2FF", "#E0E7FF"]}
          style={[styles.statBox, { borderColor: "rgba(99, 102, 241, 0.3)" }]}
        >
          <Text style={styles.statLabel}>TOTAL OWE TO YOU</Text>
          <Text style={[styles.statAmount, { color: "#6366f1" }]}>
            ₹{pendingAmount.toLocaleString("en-IN")}
          </Text>
          <Text style={[styles.statSub, { color: colors.mutedForeground }]}>
            {pendingList.length} active case{pendingList.length !== 1 ? "s" : ""}
          </Text>
        </LinearGradient>

        <LinearGradient
          colors={colors.text === "#f8fafc" ? ["#062c22", "#091a16"] : ["#ECFDF5", "#D1FAE5"]}
          style={[styles.statBox, { borderColor: "rgba(16, 185, 129, 0.3)" }]}
        >
          <Text style={styles.statLabel}>RECOVERED SO FAR</Text>
          <Text style={[styles.statAmount, { color: "#10b981" }]}>
            ₹{recoveredAmount.toLocaleString("en-IN")}
          </Text>
          <Text style={[styles.statSub, { color: colors.mutedForeground }]}>Money secured ✓</Text>
        </LinearGradient>
      </View>

      {/* Search Bar */}
      <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "rgba(255, 255, 255, 0.06)",
            borderRadius: 14,
            paddingHorizontal: 14,
            height: 44,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Feather name="search" size={16} color={colors.mutedForeground} style={{ marginRight: 8 }} />
          <TextInput
            style={{ flex: 1, fontSize: 13, color: colors.foreground, fontFamily: "Inter_400Regular" }}
            placeholder="Search merchant, order ID, amount..."
            placeholderTextColor={colors.mutedForeground}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} style={{ padding: 4 }}>
              <Feather name="x-circle" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Chips */}
      <View style={styles.filterStrip}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          <TouchableOpacity
            style={[styles.chip, selectedCategory === "ALL" && styles.chipActive]}
            onPress={() => setSelectedCategory("ALL")}
          >
            <Text style={[styles.chipText, selectedCategory === "ALL" && styles.chipTextActive]}>
              Active ({pendingList.length})
            </Text>
          </TouchableOpacity>

          {(Object.keys(CATEGORY_LABELS) as ReceivableCategory[]).map((catKey) => {
            const label = CATEGORY_LABELS[catKey].label;
            const count = receivables.filter((r) => r.category === catKey && r.status !== "RECOVERED").length;
            const isSelected = selectedCategory === catKey;
            return (
              <TouchableOpacity
                key={catKey}
                style={[styles.chip, isSelected && styles.chipActive]}
                onPress={() => setSelectedCategory(catKey)}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                  {label} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={[styles.chip, selectedCategory === "RECOVERED" && styles.chipActive]}
            onPress={() => setSelectedCategory("RECOVERED")}
          >
            <Text style={[styles.chipText, selectedCategory === "RECOVERED" && styles.chipTextActive]}>
              Recovered ✓
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Receivables List */}
      <FlatList
        data={filteredList}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100, paddingTop: 10 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Feather name="shield" size={32} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No receivables found</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              {selectedCategory === "RECOVERED"
                ? "No recovered refunds logged yet."
                : "All money owed to you has been settled or no items match this category."}
            </Text>
            <TouchableOpacity
              style={styles.addBtnEmpty}
              onPress={() => setShowAddModal(true)}
            >
              <Text style={styles.addBtnEmptyText}>+ Add Receivable</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <ReceivableItemCard
            receivable={item}
            onPress={handleCardPress}
            onStartRecovery={handleCardPress}
          />
        )}
      />

      <AddReceivableModal visible={showAddModal} onClose={() => setShowAddModal(false)} />

      <RecoveryDetailModal
        receivable={selectedReceivable}
        visible={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedReceivable(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(148, 163, 184, 0.12)",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  headerSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 14,
  },
  statBox: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
    color: "#64748b",
  },
  statAmount: {
    fontSize: 22,
    fontWeight: "800",
    fontFamily: "Inter_700Bold",
    marginVertical: 2,
  },
  statSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  filterStrip: {
    marginBottom: 6,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "rgba(148, 163, 184, 0.12)",
  },
  chipActive: {
    backgroundColor: "#6366f1",
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
    fontFamily: "Inter_600SemiBold",
  },
  chipTextActive: {
    color: "#fff",
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "rgba(148, 163, 184, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  emptySub: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
  },
  addBtnEmpty: {
    marginTop: 16,
    backgroundColor: "#6366f1",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  addBtnEmptyText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
});
