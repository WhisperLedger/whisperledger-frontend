import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSubscription } from "@/context/SubscriptionContext";
import { useColors } from "@/hooks/useColors";
import { isDarkPalette } from "@/utils/designSystem";
import { safeHaptics } from "@/utils/haptics";
import * as Haptics from "expo-haptics";

const PRO_BENEFITS = [
  {
    icon: "mic",
    title: "AI Voice Expense Auto-Logging",
    desc: "Speak naturally to log spends and run deep AI audits instantly.",
    badge: "AI Powered",
  },
  {
    icon: "shield",
    title: "Money Recovery Legal Engine",
    desc: "1-Tap WhatsApp & Email legal escalation drafts for delayed refunds.",
    badge: "Most Popular",
  },
  {
    icon: "file-text",
    title: "Bank-Grade PDF Statements",
    desc: "Export credit-card style monthly financial summaries & CSV tables.",
    badge: "Tax Ready",
  },
  {
    icon: "pie-chart",
    title: "Unlimited Smart Budgets",
    desc: "Set real-time limit alerts (50%, 80%, 100%) across all categories.",
    badge: "Proactive",
  },
  {
    icon: "lock",
    title: "Biometric Security Vault",
    desc: "Protect sensitive finances with Face ID, Fingerprint & Passcode.",
    badge: "Encrypted",
  },
  {
    icon: "zap",
    title: "Priority Background SMS Sync",
    desc: "Real-time on-device background transaction parsing with 0 battery burn.",
    badge: "Zero Friction",
  },
];

export default function PaywallModal() {
  const {
    isPro,
    paywallVisible,
    paywallFeature,
    closePaywall,
    planConfig,
    pendingProRequest,
    pendingProPlan,
    upgradePlan,
    startTrial,
    trialUsed,
  } = useSubscription();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isDark = isDarkPalette(colors);
  const styles = createPaywallStyles(colors, isDark);

  const [selectedPlan, setSelectedPlan] = useState<"yearly" | "monthly">("yearly");
  const [loading, setLoading] = useState(false);

  if (!paywallVisible || isPro) return null;

  const monthlyEquivalent = Math.round(planConfig.yearlyPrice / 12);
  const selectedPlanLabel = selectedPlan === "yearly" ? "Annual" : "Monthly";
  const pendingPlanLabel = pendingProPlan === "yearly" ? "Annual" : pendingProPlan === "monthly" ? "Monthly" : "Pro";
  const selectedPrice = selectedPlan === "yearly" ? planConfig.yearlyPrice : planConfig.monthlyPrice;
  const selectedInterval = selectedPlan === "yearly" ? "year" : "month";

  const handleStartTrial = async () => {
    setLoading(true);
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const success = await startTrial();
    setLoading(false);
    if (success) {
      Alert.alert("Trial requested", "Your trial request is queued. Pro features unlock after the request is approved.");
      closePaywall();
    } else {
      Alert.alert("Trial unavailable", pendingProRequest ? "An access request is already pending." : "You have already used your trial or are not eligible.");
    }
  };

  const handleSubscribe = async () => {
    setLoading(true);
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const success = await upgradePlan(selectedPlan, false);
    setLoading(false);
    if (success) {
      Alert.alert("Upgrade request submitted", `Your ${selectedPlanLabel} Pro request is queued. Access unlocks after verified payment and approval.`);
      closePaywall();
    } else {
      Alert.alert("Request unavailable", pendingProRequest ? "An upgrade request is already pending." : "Please try again or check your network connection.");
    }
  };

  return (
    <Modal visible={paywallVisible} animationType="slide" transparent onRequestClose={closePaywall}>
      <View style={[styles.overlay, { backgroundColor: isDark ? "rgba(0,0,0,0.78)" : "rgba(15,23,42,0.45)" }]}>
        <View style={[styles.container, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.sheetHandle} />
          {/* Top Header & Dismiss */}
          <View style={styles.header}>
            <View style={styles.vipBadge}>
              <Feather name="shield" size={12} color={colors.primary} />
              <Text style={styles.vipBadgeText}>PRO ACCESS</Text>
            </View>
            <TouchableOpacity onPress={closePaywall} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Hero Title Area */}
            <View style={styles.heroWrap}>
              <View style={styles.proIconCluster}>
                <LinearGradient
                  colors={isDark ? ["#3882FF", "#1D4ED8"] : ["#0066FF", "#0052CC"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.proGlow}
                >
                  <Feather name="zap" size={26} color="#FFFFFF" />
                </LinearGradient>
              </View>

              <View style={styles.heroCopy}>
                <Text style={styles.heroTitle}>WhisperLedger Pro</Text>
                <Text style={styles.heroSubtitle}>
                  Unlock <Text style={{ color: colors.primary, fontWeight: "700" }}>{paywallFeature}</Text> and all advanced financial intelligence tools.
                </Text>
              </View>
            </View>

            {/* Dynamic Plan Selector Cards */}
            <View style={styles.planCardsContainer}>
              {/* Annual Plan Card */}
              <TouchableOpacity
                style={[
                  styles.planCard,
                  selectedPlan === "yearly" && styles.planCardActive,
                ]}
                onPress={() => {
                  safeHaptics.selectionAsync();
                  setSelectedPlan("yearly");
                }}
                activeOpacity={0.85}
              >
                <View style={styles.planTopRow}>
                  <View style={styles.discountTag}>
                    <Text style={styles.discountTagText}>SAVE {planConfig.discountPercentage}%</Text>
                  </View>
                  <View style={[styles.radioOuter, selectedPlan === "yearly" && styles.radioOuterActive]}>
                    {selectedPlan === "yearly" && <View style={styles.radioInner} />}
                  </View>
                </View>

                <View>
                  <Text style={styles.planName}>Annual</Text>
                  <Text style={styles.planPrice}>₹{planConfig.yearlyPrice}</Text>
                  <Text style={styles.planPerMonth}>₹{monthlyEquivalent}/month</Text>
                </View>
              </TouchableOpacity>

              {/* Monthly Plan Card */}
              <TouchableOpacity
                style={[
                  styles.planCard,
                  selectedPlan === "monthly" && styles.planCardActive,
                ]}
                onPress={() => {
                  safeHaptics.selectionAsync();
                  setSelectedPlan("monthly");
                }}
                activeOpacity={0.85}
              >
                <View style={styles.planTopRow}>
                  <View style={styles.flexTag}>
                    <Text style={styles.flexTagText}>FLEXIBLE</Text>
                  </View>
                  <View style={[styles.radioOuter, selectedPlan === "monthly" && styles.radioOuterActive]}>
                    {selectedPlan === "monthly" && <View style={styles.radioInner} />}
                  </View>
                </View>

                <View>
                  <Text style={styles.planName}>Monthly</Text>
                  <Text style={styles.planPrice}>₹{planConfig.monthlyPrice}</Text>
                  <Text style={styles.planPerMonth}>Cancel anytime</Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.selectionSummary}>
              <View>
                <Text style={styles.summaryLabel}>Selected plan</Text>
                <Text style={styles.summaryTitle}>{selectedPlanLabel} Pro</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.summaryPrice}>₹{selectedPrice}</Text>
                <Text style={styles.summaryInterval}>per {selectedInterval}</Text>
              </View>
            </View>

            {/* Feature Matrix Showcase */}
            <Text style={styles.sectionHeader}>WHAT'S INCLUDED IN PRO</Text>
            <View style={styles.benefitList}>
              {PRO_BENEFITS.map((b, i) => (
                <View key={i} style={styles.benefitItem}>
                  <View style={styles.benefitIconWrap}>
                    <Feather name={b.icon as any} size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <Text style={styles.benefitTitle}>{b.title}</Text>
                      <View style={styles.featureBadge}>
                        <Text style={styles.featureBadgeText}>{b.badge}</Text>
                      </View>
                    </View>
                    <Text style={styles.benefitDesc}>{b.desc}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Security Guarantee Box */}
            <View style={styles.securityBox}>
              <Feather name="lock" size={14} color="#10B981" />
              <Text style={styles.securityBoxText}>
                100% On-Device Local Privacy Guaranteed • No Ads • Cancel anytime
              </Text>
            </View>
          </ScrollView>

          {/* Bottom Sticky CTA Button */}
          <View style={styles.footer}>
            {!trialUsed ? (
              <>
                <TouchableOpacity
                  style={styles.ctaButton}
                  onPress={handleStartTrial}
                  disabled={loading}
                  activeOpacity={0.9}
                >
                  <LinearGradient
                    colors={["#0066FF", "#0047BA"]}
                    style={styles.ctaGrad}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Feather name="zap" size={18} color="#FFD700" />
                        <Text style={styles.ctaText}>
                          Request 7-Day Free Trial
                        </Text>
                        <Feather name="arrow-right" size={18} color="#fff" />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{ marginTop: 10, alignItems: "center" }}
                  onPress={handleSubscribe}
                  disabled={loading}
                >
                  <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.primary }}>
                    Request {selectedPlanLabel} Pro (₹{selectedPrice}/{selectedInterval})
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={styles.ctaButton}
                onPress={handleSubscribe}
                disabled={loading}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={["#0066FF", "#0047BA"]}
                  style={styles.ctaGrad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.ctaText}>
                        Request {selectedPlanLabel} Pro (₹{selectedPrice})
                      </Text>
                      <Feather name="arrow-right" size={18} color="#fff" />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            )}

            <Text style={styles.footerNote}>
              {!trialUsed
                ? "Trial access unlocks only after approval. Paid plans require verified payment."
                : pendingProRequest
                  ? "Pro will unlock only after admin marks approval and payment as received."
                  : `Trial already used. Pro activates after approval: ₹${selectedPrice}/${selectedPlan === "yearly" ? "yr" : "mo"}.`}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function createPaywallStyles(colors: ReturnType<typeof useColors>, isDark: boolean) {
  return StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: "92%",
  },
  sheetHandle: {
    width: 46,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  vipBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: isDark ? "rgba(56, 130, 255, 0.15)" : "#EFF6FF",
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: isDark ? "rgba(56, 130, 255, 0.3)" : "#BFDBFE",
  },
  vipBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: colors.primary,
    letterSpacing: 0.8,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: isDark ? "rgba(255,255,255,0.06)" : colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  heroWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 4,
    marginBottom: 16,
  },
  proIconCluster: {
    width: 82,
    alignItems: "center",
  },
  proGlow: {
    width: 62,
    height: 62,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  iconSkinBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: isDark ? "rgba(56, 130, 255, 0.14)" : "#EFF6FF",
    borderWidth: 1,
    borderColor: isDark ? "rgba(56, 130, 255, 0.28)" : "#BFDBFE",
  },
  iconSkinText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: colors.primary,
  },
  heroCopy: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 23,
    fontFamily: "Inter_700Bold",
    color: colors.foreground,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: colors.mutedForeground,
    lineHeight: 19,
  },
  planCardsContainer: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  planCard: {
    flex: 1,
    minHeight: 136,
    backgroundColor: isDark ? colors.secondary : "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    justifyContent: "space-between",
  },
  planCardActive: {
    borderColor: colors.primary,
    backgroundColor: isDark ? "rgba(56, 130, 255, 0.14)" : "#EFF6FF",
    shadowColor: "#0066FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  planTopRow: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  discountTag: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  discountTagText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
  flexTag: {
    alignSelf: "flex-start",
    backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : colors.muted,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  flexTagText: {
    color: colors.mutedForeground,
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterActive: {
    borderColor: colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  selectionSummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 16,
    backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "#FFFFFF",
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: colors.mutedForeground,
  },
  summaryTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: colors.foreground,
    marginTop: 2,
  },
  summaryPrice: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: colors.primary,
  },
  summaryInterval: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: colors.mutedForeground,
    marginTop: 2,
  },
  planName: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: colors.foreground,
  },
  planPerMonth: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: colors.mutedForeground,
    marginTop: 2,
  },
  planPrice: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: colors.foreground,
    marginTop: 6,
  },
  sectionHeader: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: colors.mutedForeground,
    letterSpacing: 0.8,
    marginTop: 10,
    marginBottom: 12,
  },
  iconCompareCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 16,
  },
  iconCompareSide: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  iconCompareDivider: {
    width: 1,
    height: 48,
    backgroundColor: colors.border,
    marginHorizontal: 8,
  },
  normalIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: isDark ? "rgba(56, 130, 255, 0.12)" : "#EFF6FF",
    borderWidth: 1,
    borderColor: isDark ? "rgba(56, 130, 255, 0.25)" : "#BFDBFE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  proIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  iconCompareTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: colors.foreground,
    textAlign: "center",
  },
  iconCompareDesc: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: colors.mutedForeground,
    textAlign: "center",
  },
  benefitList: {
    gap: 12,
    marginBottom: 16,
  },
  benefitItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "#FFFFFF",
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  benefitIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: isDark ? "rgba(56, 130, 255, 0.15)" : "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  benefitTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: colors.foreground,
  },
  featureBadge: {
    backgroundColor: isDark ? "rgba(56, 130, 255, 0.2)" : "#DBEAFE",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  featureBadgeText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: colors.primary,
  },
  benefitDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: colors.mutedForeground,
    lineHeight: 16,
  },
  securityBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: isDark ? "rgba(16, 185, 129, 0.12)" : "#ECFDF5",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: isDark ? "rgba(16, 185, 129, 0.25)" : "#A7F3D0",
  },
  securityBoxText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: isDark ? "#A7F3D0" : "#047857",
    flex: 1,
    lineHeight: 15,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  ctaButton: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#0066FF",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  ctaButtonDisabled: {
    opacity: 0.72,
  },
  ctaGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  ctaText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  footerNote: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: colors.mutedForeground,
    textAlign: "center",
    marginTop: 8,
  },
  });
}
