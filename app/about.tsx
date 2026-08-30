import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import { useColors } from "@/hooks/useColors";
import { appGradients, iconSurface, surfaceStyle } from "@/utils/designSystem";

export default function AboutScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const gradients = appGradients(colors);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={gradients.hero}
        style={[styles.header, { paddingTop: insets.top + 16, paddingBottom: 24 }]}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Feather name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>About WhisperLedger</Text>
          <View style={{ width: 24 }} />
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Story Card */}
        <View style={[styles.card, surfaceStyle(colors)]}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>Built for daily money clarity</Text>
          
          <Text style={[styles.paragraph, { color: colors.foreground }]}>
            WhisperLedger is designed for fast daily expense logging, practical spending visibility, and fewer missed transactions.
          </Text>
          
          <Text style={[styles.paragraph, { color: colors.foreground }]}>
            The goal is to replace messy notes and spreadsheets with a focused ledger that helps you understand where your money goes.
          </Text>
        </View>

        {/* Vision Card */}
        <View style={[styles.card, surfaceStyle(colors)]}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>Our Vision</Text>
          <Text style={[styles.paragraph, { color: colors.foreground }]}>
            That's why I created <Text style={{ fontFamily: "Inter_700Bold", color: colors.primary }}>WhisperLedger</Text>. Its core purpose is to provide a clean, beautiful interface for you to log and categorize your daily expenses effortlessly, replacing the mess of a standard notes app.
          </Text>
        </View>

        {/* Feature Callout Card */}
        <View style={[styles.card, surfaceStyle(colors)]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <View style={[styles.iconBg, iconSurface(colors, "primary")]}>
              <Feather name="zap" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.cardHeaderTitle, { color: colors.foreground }]}>Bonus Feature</Text>
          </View>
          <Text style={[styles.paragraph, { color: colors.mutedForeground, fontSize: 14 }]}>
            As an added bonus feature, WhisperLedger also includes an optional SMS Auto-Sync. If enabled, it securely reads the transactional "whispers" from your incoming bank SMS messages and logs them automatically.
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
            Made by Tanmay Agarwal
          </Text>
          <Text style={[styles.footerText, { color: colors.mutedForeground, marginTop: 4 }]}>
            Version 1.0.0
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  closeBtn: {
    padding: 4,
    marginLeft: -4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    marginBottom: 12,
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  iconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  paragraph: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
    marginBottom: 12,
  },
  footer: {
    marginTop: 20,
    alignItems: "center",
  },
  footerText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
});
