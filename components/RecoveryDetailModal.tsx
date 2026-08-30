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
import type { Receivable } from "@/types/receivable";
import {
  getReceivableStatusMeta,
  calculateDaysOverdue,
  generateEvidenceSummary,
  generateEscalationDraft,
} from "@/utils/recoveryEngine";
import { safeHaptics } from "@/utils/haptics";

interface RecoveryDetailModalProps {
  receivable: Receivable | null;
  visible: boolean;
  onClose: () => void;
}

export default function RecoveryDetailModal({ receivable, visible, onClose }: RecoveryDetailModalProps) {
  const colors = useColors();
  const { addInteractionLog, markAsRecovered, deleteReceivable } = useReceivables();

  const [activeTab, setActiveTab] = useState<"timeline" | "escalation">("escalation");
  const [escalationLevel, setEscalationLevel] = useState<1 | 2 | 3>(1);
  const [supportNote, setSupportNote] = useState("");
  const [newWaitHours, setNewWaitHours] = useState("");

  if (!receivable) return null;

  const meta = getReceivableStatusMeta(receivable.status, receivable.expectedRefundDate);
  const daysOverdue = calculateDaysOverdue(receivable.expectedRefundDate);
  const escalationDraft = generateEscalationDraft(receivable, escalationLevel);
  const evidenceSummary = generateEvidenceSummary(receivable);

  const handleCopyText = async (text: string, label: string) => {
    try {
      // Lazy load clipboard if available
      let ClipboardModule: any = null;
      try {
        ClipboardModule = require("expo-clipboard");
      } catch {
        // Fallback to react-native
        try {
          ClipboardModule = require("react-native").Clipboard;
        } catch {}
      }

      if (ClipboardModule?.setStringAsync) {
        await ClipboardModule.setStringAsync(text);
      } else if (ClipboardModule?.setString) {
        ClipboardModule.setString(text);
      }
      safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Copied!", `${label} copied to clipboard.`);
    } catch (e) {
      safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Text Ready", `${label} prepared:\n\n${text}`);
    }
  };

  const handleAddSupportResponse = async () => {
    if (!supportNote.trim()) {
      Alert.alert("Missing note", "Please enter the merchant support response.");
      return;
    }

    let newDateIso: string | undefined = undefined;
    const hours = parseInt(newWaitHours, 10);
    if (!Number.isNaN(hours) && hours > 0) {
      const d = new Date();
      d.setHours(d.getHours() + hours);
      newDateIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }

    await addInteractionLog(receivable.id, supportNote.trim(), newDateIso);
    safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSupportNote("");
    setNewWaitHours("");
    Alert.alert("Updated!", "Support interaction recorded & refund timeline updated.");
  };

  const handleMarkRecovered = async () => {
    Alert.alert("Confirm Recovery", `Mark ₹${receivable.amount.toLocaleString("en-IN")} from ${receivable.merchant} as recovered?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Yes, Money Received ✓",
        onPress: async () => {
          await markAsRecovered(receivable.id);
          safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onClose();
        },
      },
    ]);
  };

  const handleDelete = async () => {
    Alert.alert("Delete Receivable", "Are you sure you want to remove this tracked item?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteReceivable(receivable.id);
          onClose();
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <View style={styles.merchantHeaderRow}>
                <Text style={[styles.merchantName, { color: colors.foreground }]}>{receivable.merchant}</Text>
                <View style={[styles.statusBadge, { backgroundColor: meta.badgeColor }]}>
                  <Text style={[styles.statusText, { color: meta.textColor }]}>{meta.label}</Text>
                </View>
              </View>
              <Text style={styles.amountHero}>₹{receivable.amount.toLocaleString("en-IN")}</Text>
              <Text style={[styles.promisedText, { color: meta.isOverdue ? "#ef4444" : colors.mutedForeground }]}>
                {meta.isOverdue
                  ? `Promised deadline ${receivable.expectedRefundDate} passed (${daysOverdue} days overdue)`
                  : `Expected refund by ${receivable.expectedRefundDate} (${receivable.promisedWindow || "3-5 business days"})`}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          {/* Action Row */}
          <View style={styles.quickActionRow}>
            {receivable.status !== "RECOVERED" && (
              <TouchableOpacity style={styles.recoveredBtn} activeOpacity={0.8} onPress={handleMarkRecovered}>
                <Feather name="check-circle" size={16} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.recoveredBtnText}>Mark Recovered ✓</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.deleteBtn} activeOpacity={0.8} onPress={handleDelete}>
              <Feather name="trash-2" size={16} color="#ef4444" />
            </TouchableOpacity>
          </View>

          {/* Nav Tabs */}
          <View style={[styles.tabBar, { backgroundColor: colors.background }]}>
            <TouchableOpacity
              style={[styles.tab, activeTab === "escalation" && styles.activeTab]}
              onPress={() => setActiveTab("escalation")}
            >
              <Feather name="shield" size={14} color={activeTab === "escalation" ? "#6366f1" : colors.mutedForeground} />
              <Text style={[styles.tabText, { color: activeTab === "escalation" ? "#6366f1" : colors.mutedForeground }]}>
                Escalation Engine
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === "timeline" && styles.activeTab]}
              onPress={() => setActiveTab("timeline")}
            >
              <Feather name="clock" size={14} color={activeTab === "timeline" ? "#6366f1" : colors.mutedForeground} />
              <Text style={[styles.tabText, { color: activeTab === "timeline" ? "#6366f1" : colors.mutedForeground }]}>
                Case Timeline & Logs
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
            {activeTab === "escalation" ? (
              <View style={{ paddingTop: 8 }}>
                {/* Level selector */}
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Escalation Ladder</Text>
                <View style={styles.levelRow}>
                  <TouchableOpacity
                    style={[styles.levelChip, escalationLevel === 1 && styles.levelChipActive]}
                    onPress={() => setEscalationLevel(1)}
                  >
                    <Text style={[styles.levelChipText, escalationLevel === 1 && styles.levelChipTextActive]}>
                      L1: Support Chat
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.levelChip, escalationLevel === 2 && styles.levelChipActive]}
                    onPress={() => setEscalationLevel(2)}
                  >
                    <Text style={[styles.levelChipText, escalationLevel === 2 && styles.levelChipTextActive]}>
                      L2: Grievance Officer
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.levelChip, escalationLevel === 3 && styles.levelChipActive]}
                    onPress={() => setEscalationLevel(3)}
                  >
                    <Text style={[styles.levelChipText, escalationLevel === 3 && styles.levelChipTextActive]}>
                      L3: NCH Grievance
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Draft Card */}
                <View style={[styles.draftBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={styles.draftTitle}>{escalationDraft.title}</Text>
                  <Text style={[styles.draftBody, { color: colors.foreground }]}>{escalationDraft.body}</Text>
                  <TouchableOpacity
                    style={styles.copyBtn}
                    onPress={() => handleCopyText(escalationDraft.body, escalationDraft.title)}
                  >
                    <Feather name="copy" size={14} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.copyBtnText}>Copy Complaint Text</Text>
                  </TouchableOpacity>
                </View>

                {/* Evidence Dossier Card */}
                <View style={[styles.evidenceBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={styles.evidenceTitle}>Assembled Evidence Dossier</Text>
                  <Text style={[styles.evidenceBody, { color: colors.mutedForeground }]}>{evidenceSummary}</Text>
                  <TouchableOpacity
                    style={styles.copyOutlineBtn}
                    onPress={() => handleCopyText(evidenceSummary, "Evidence Dossier")}
                  >
                    <Feather name="file-text" size={14} color={colors.primary} style={{ marginRight: 6 }} />
                    <Text style={[styles.copyOutlineText, { color: colors.primary }]}>Copy Full Evidence</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={{ paddingTop: 8 }}>
                {/* Record Interaction Form */}
                <View style={[styles.addLogBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Record Support Interaction</Text>
                  <TextInput
                    style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
                    placeholder="e.g. Support agent promised 48h wait period"
                    placeholderTextColor={colors.mutedForeground}
                    value={supportNote}
                    onChangeText={setSupportNote}
                  />
                  <View style={styles.row}>
                    <TextInput
                      style={[styles.input, { flex: 1, marginRight: 8, color: colors.foreground, borderColor: colors.border }]}
                      placeholder="Add Wait Hours (e.g. 48)"
                      keyboardType="numeric"
                      placeholderTextColor={colors.mutedForeground}
                      value={newWaitHours}
                      onChangeText={setNewWaitHours}
                    />
                    <TouchableOpacity style={styles.logSaveBtn} onPress={handleAddSupportResponse}>
                      <Text style={styles.logSaveText}>Record Log</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Timeline History */}
                <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 14 }]}>Timeline History</Text>
                {receivable.history && receivable.history.length > 0 ? (
                  receivable.history.map((h, idx) => (
                    <View key={h.id || idx} style={styles.historyItem}>
                      <View style={styles.historyDot} />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={[styles.historyStatus, { color: colors.foreground }]}>
                          [{h.status}] {h.actor ? `(${h.actor.toUpperCase()})` : ""}
                        </Text>
                        <Text style={[styles.historyNote, { color: colors.mutedForeground }]}>{h.note}</Text>
                        {h.newExpectedDate && (
                          <Text style={{ fontSize: 11, color: "#f59e0b", marginTop: 2 }}>
                            New Promised Date: {h.newExpectedDate}
                          </Text>
                        )}
                        <Text style={{ fontSize: 10, color: colors.mutedForeground, marginTop: 2 }}>
                          {new Date(h.timestamp).toLocaleString("en-IN")}
                        </Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={{ fontSize: 13, color: colors.mutedForeground, marginVertical: 10 }}>
                    No timeline logs available yet.
                  </Text>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  merchantHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  merchantName: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  amountHero: {
    fontSize: 28,
    fontWeight: "800",
    fontFamily: "Inter_700Bold",
    color: "#6366f1",
    marginVertical: 4,
  },
  promisedText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 14,
  },
  recoveredBtn: {
    flex: 1,
    backgroundColor: "#10b981",
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  recoveredBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  deleteBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  tabBar: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 6,
    fontFamily: "Inter_600SemiBold",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    marginBottom: 8,
  },
  levelRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 12,
  },
  levelChip: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.3)",
    alignItems: "center",
  },
  levelChipActive: {
    backgroundColor: "#6366f1",
    borderColor: "#6366f1",
  },
  levelChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
    fontFamily: "Inter_600SemiBold",
  },
  levelChipTextActive: {
    color: "#fff",
  },
  draftBox: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  draftTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6366f1",
    marginBottom: 6,
    fontFamily: "Inter_700Bold",
  },
  draftBody: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
  },
  copyBtn: {
    backgroundColor: "#6366f1",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  copyBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  evidenceBox: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  evidenceTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f766e",
    marginBottom: 6,
    fontFamily: "Inter_700Bold",
  },
  evidenceBody: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
  },
  copyOutlineBtn: {
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.3)",
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  copyOutlineText: {
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  addLogBox: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    marginBottom: 8,
    fontFamily: "Inter_400Regular",
  },
  row: {
    flexDirection: "row",
  },
  logSaveBtn: {
    backgroundColor: "#f59e0b",
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    height: 38,
  },
  logSaveText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#6366f1",
    marginTop: 4,
  },
  historyStatus: {
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  historyNote: {
    fontSize: 12,
    marginTop: 2,
    fontFamily: "Inter_400Regular",
  },
});
