import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/useColors";
import { safeHaptics } from "@/utils/haptics";

interface PrivacyConsentModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirmConsent: () => void;
}

export default function PrivacyConsentModal({
  visible,
  onClose,
  onConfirmConsent,
}: PrivacyConsentModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [checkOnDevice, setCheckOnDevice] = useState(false);
  const [checkScope, setCheckScope] = useState(false);

  const canProceed = checkOnDevice && checkScope;

  const isDark = colors.text === "#f8fafc";
  const cardBg = isDark ? "rgba(255, 255, 255, 0.05)" : "#F1F5F9";
  const cardBorder = isDark ? "rgba(255, 255, 255, 0.08)" : colors.border;

  const handleProceed = async () => {
    if (!canProceed) return;
    safeHaptics.notificationAsync();
    try {
      await AsyncStorage.setItem("@user_privacy_consent_accepted", JSON.stringify({
        accepted: true,
        timestamp: new Date().toISOString(),
        version: "1.0.0",
      }));
    } catch (e) {
      console.warn("Failed to save consent to AsyncStorage:", e);
    }
    onConfirmConsent();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.container,
            {
              backgroundColor: colors.card,
              paddingBottom: Math.max(insets.bottom, 20),
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: isDark ? "rgba(56, 130, 255, 0.15)" : "#F0F7FF" }]}>
              <Feather name="shield" size={24} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>
              SMS & Privacy Consent
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Please read our data processing disclosure carefully before enabling SMS auto-sync.
            </Text>
          </View>

          {/* Consent Body Scroll */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator
          >
            {/* Clause 1 */}
            <View style={[styles.clauseCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={styles.clauseHeader}>
                <Feather name="cpu" size={18} color="#10B981" />
                <Text style={[styles.clauseTitle, { color: colors.foreground }]}>100% On-Device Processing</Text>
              </View>
              <Text style={[styles.clauseBody, { color: colors.mutedForeground }]}>
                All incoming SMS messages are read and parsed entirely on your local device. Raw SMS text content is never stored on cloud servers or transmitted over the network.
              </Text>
            </View>

            {/* Clause 2 */}
            <View style={[styles.clauseCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={styles.clauseHeader}>
                <Feather name="crosshair" size={18} color={colors.primary} />
                <Text style={[styles.clauseTitle, { color: colors.foreground }]}>Strict Financial Scope</Text>
              </View>
              <Text style={[styles.clauseBody, { color: colors.mutedForeground }]}>
                Only transactional notifications from banks, UPI apps (Paytm, PhonePe, GPay), and e-commerce platforms (Amazon, Swiggy, Flipkart, MakeMyTrip) are analyzed. Personal OTPs and private conversations are completely ignored.
              </Text>
            </View>

            {/* Clause 3 */}
            <View style={[styles.clauseCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={styles.clauseHeader}>
                <Feather name="refresh-cw" size={18} color="#F59E0B" />
                <Text style={[styles.clauseTitle, { color: colors.foreground }]}>Data Ownership & Revocation</Text>
              </View>
              <Text style={[styles.clauseBody, { color: colors.mutedForeground }]}>
                You retain full ownership of your data. You can turn off SMS auto-sync, clear local caches, or export your money recovery ledger at any time from your Profile settings.
              </Text>
            </View>

            {/* Checkboxes Section */}
            <View style={[styles.checkboxSection, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.checkboxRow}
                onPress={() => {
                  safeHaptics.selectionAsync();
                  setCheckOnDevice(!checkOnDevice);
                }}
              >
                <View
                  style={[
                    styles.checkbox,
                    { borderColor: colors.border },
                    checkOnDevice && styles.checkboxActive,
                  ]}
                >
                  {checkOnDevice && <Feather name="check" size={14} color="#FFF" />}
                </View>
                <Text style={[styles.checkboxText, { color: colors.foreground }]}>
                  I understand that my SMS texts are parsed 100% locally on my device and never uploaded.
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.checkboxRow}
                onPress={() => {
                  safeHaptics.selectionAsync();
                  setCheckScope(!checkScope);
                }}
              >
                <View
                  style={[
                    styles.checkbox,
                    { borderColor: colors.border },
                    checkScope && styles.checkboxActive,
                  ]}
                >
                  {checkScope && <Feather name="check" size={14} color="#FFF" />}
                </View>
                <Text style={[styles.checkboxText, { color: colors.foreground }]}>
                  I consent to allow WhisperLedger to detect bank & merchant refund notifications for post-purchase recovery.
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.confirmBtn,
                !canProceed && styles.confirmBtnDisabled,
              ]}
              disabled={!canProceed}
              onPress={handleProceed}
              activeOpacity={0.8}
            >
              <Feather name="check-circle" size={18} color="#FFF" style={{ marginRight: 8 }} />
              <Text style={styles.confirmBtnText}>Accept & Enable SMS Sync</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => {
                safeHaptics.selectionAsync();
                onClose();
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>
                Decline / Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "flex-end",
  },
  container: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "88%",
    paddingTop: 24,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: "center",
    marginBottom: 16,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(0, 102, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    fontWeight: "700",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 18,
  },
  scrollArea: {
    maxHeight: 340,
  },
  scrollContent: {
    paddingVertical: 8,
    gap: 12,
  },
  clauseCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  clauseHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  clauseTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  clauseBody: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  checkboxSection: {
    marginTop: 8,
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxActive: {
    backgroundColor: "#0066FF",
    borderColor: "#0066FF",
  },
  checkboxText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    lineHeight: 17,
  },
  footer: {
    marginTop: 20,
    gap: 10,
  },
  confirmBtn: {
    flexDirection: "row",
    height: 50,
    borderRadius: 16,
    backgroundColor: "#0066FF",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnDisabled: {
    backgroundColor: "rgba(0, 102, 255, 0.35)",
    opacity: 0.5,
  },
  confirmBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  cancelBtn: {
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
});
