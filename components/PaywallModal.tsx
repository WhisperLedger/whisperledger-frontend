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
  const { paywallVisible, paywallFeature, closePaywall, planConfig, upgradePlan } = useSubscription();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isDark = isDarkPalette(colors);

  const [selectedPlan, setSelectedPlan] = useState<"yearly" | "monthly">("yearly");
  const [loading, setLoading] = useState(false);

  if (!paywallVisible) return null;

  const monthlyEquivalent = Math.round(planConfig.yearlyPrice / 12);

  const handleSubscribe = async () => {
    setLoading(true);
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const success = await upgradePlan(selectedPlan, true);
    setLoading(false);
    if (success) {
      Alert.alert("Request sent", "Your Pro trial request has been sent. Access unlocks as soon as the admin approves it.");
    }
  };

  return (
    <Modal visible={paywallVisible} animationType="slide" transparent onRequestClose={closePaywall}>
      <View style={styles.overlay}>
        <View style={[styles.container, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 16 }]}>
          {/* Top Header & Dismiss */}
          <View style={styles.header}>
            <View style={styles.vipBadge}>
              <Text style={styles.vipBadgeText}>👑 VIP PRO ACCESS</Text>
            </View>
            <TouchableOpacity onPress={closePaywall} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Hero Title Area */}
            <View style={styles.heroWrap}>
              <LinearGradient
                colors={["#FFD700", "#FFA500", "#FF8C00"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.goldGlow}
              >
                <Feather name="star" size={28} color="#FFFFFF" />
              </LinearGradient>

              <Text style={styles.heroTitle}>Upgrade to WhisperLedger Pro</Text>
              <Text style={styles.heroSubtitle}>
                Unlock <Text style={{ color: "#60A5FA", fontWeight: "700" }}>{paywallFeature}</Text> with verified Pro access managed from the admin console.
              </Text>
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
                <View style={styles.discountTag}>
                  <Text style={styles.discountTagText}>SAVE {planConfig.discountPercentage}% • BEST VALUE</Text>
                </View>

                <View style={styles.planCardHeader}>
                  <View style={styles.radioWrap}>
                    <View style={[styles.radioOuter, selectedPlan === "yearly" && styles.radioOuterActive]}>
                      {selectedPlan === "yearly" && <View style={styles.radioInner} />}
                    </View>
                    <View>
                      <Text style={styles.planName}>Annual Membership</Text>
                      <Text style={styles.planPerMonth}>Just ₹{monthlyEquivalent}/month</Text>
                    </View>
                  </View>

                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.planPrice}>₹{planConfig.yearlyPrice}</Text>
                    <Text style={styles.planInterval}>/ year</Text>
                  </View>
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
                <View style={styles.planCardHeader}>
                  <View style={styles.radioWrap}>
                    <View style={[styles.radioOuter, selectedPlan === "monthly" && styles.radioOuterActive]}>
                      {selectedPlan === "monthly" && <View style={styles.radioInner} />}
                    </View>
                    <View>
                      <Text style={styles.planName}>Monthly Membership</Text>
                      <Text style={styles.planPerMonth}>Flexible, cancel anytime</Text>
                    </View>
                  </View>

                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.planPrice}>₹{planConfig.monthlyPrice}</Text>
                    <Text style={styles.planInterval}>/ month</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>

            {/* Feature Matrix Showcase */}
            <Text style={styles.sectionHeader}>WHAT'S INCLUDED IN PRO</Text>
            <View style={styles.benefitList}>
              {PRO_BENEFITS.map((b, i) => (
                <View key={i} style={styles.benefitItem}>
                  <View style={styles.benefitIconWrap}>
                    <Feather name={b.icon as any} size={18} color="#60A5FA" />
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
                      Request {planConfig.trialDays}-Day Pro Trial
                    </Text>
                    <Feather name="arrow-right" size={18} color="#fff" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <Text style={styles.footerNote}>
              Pricing shown from live admin config: {selectedPlan === "yearly" ? `₹${planConfig.yearlyPrice}/yr` : `₹${planConfig.monthlyPrice}/mo`}. Pro unlock requires approved entitlement.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#080B15",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderColor: "rgba(56, 130, 255, 0.25)",
    maxHeight: "94%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  vipBadge: {
    backgroundColor: "rgba(255, 215, 0, 0.15)",
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 215, 0, 0.4)",
  },
  vipBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#FBBF24",
    letterSpacing: 0.8,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  heroWrap: {
    alignItems: "center",
    marginVertical: 14,
  },
  goldGlow: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  heroTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: 12,
  },
  planCardsContainer: {
    gap: 12,
    marginVertical: 16,
  },
  planCard: {
    backgroundColor: "#0E1528",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.08)",
  },
  planCardActive: {
    borderColor: "#0066FF",
    backgroundColor: "rgba(0, 102, 255, 0.12)",
    shadowColor: "#0066FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  discountTag: {
    alignSelf: "flex-start",
    backgroundColor: "#F59E0B",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  discountTagText: {
    color: "#000",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  planCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  radioWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#64748B",
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterActive: {
    borderColor: "#0066FF",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#0066FF",
  },
  planName: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  planPerMonth: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
    marginTop: 2,
  },
  planPrice: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  planInterval: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
  },
  sectionHeader: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#64748B",
    letterSpacing: 0.8,
    marginTop: 10,
    marginBottom: 12,
  },
  benefitList: {
    gap: 12,
    marginBottom: 16,
  },
  benefitItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  benefitIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(56, 130, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  benefitTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
  },
  featureBadge: {
    backgroundColor: "rgba(56, 130, 255, 0.2)",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  featureBadgeText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "#93C5FD",
  },
  benefitDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
    lineHeight: 16,
  },
  securityBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
  },
  securityBoxText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#A7F3D0",
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
    color: "#64748B",
    textAlign: "center",
    marginTop: 8,
  },
});
