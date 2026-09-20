import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { isDarkPalette } from "@/utils/designSystem";

interface Props {
  size?: number;
  isPro?: boolean;
  showProLabel?: boolean;
}

export default function ProAppLogo({
  size = 56,
  isPro = false,
  showProLabel = true,
}: Props) {
  const colors = useColors();
  const isDark = isDarkPalette(colors);
  const borderRadius = Math.round(size * 0.3);

  return (
    <View style={styles.container}>
      <View style={{ position: "relative" }}>
        {/* Outer Glow & Border for Pro */}
        <LinearGradient
          colors={
            isPro
              ? ["#FFD700", "#F59E0B", "#B45309"]
              : isDark
              ? ["rgba(56, 130, 255, 0.4)", "rgba(56, 130, 255, 0.1)"]
              : ["#6366F1", "#4F46E5"]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.logoWrap,
            {
              width: size,
              height: size,
              borderRadius,
              padding: isPro ? 2.5 : 0,
            },
            isPro && styles.proGlow,
          ]}
        >
          {isPro ? (
            <View
              style={[
                styles.innerWrap,
                {
                  borderRadius: borderRadius - 2,
                  backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
                },
              ]}
            >
              <Image
                source={require("@/assets/images/icon.png")}
                style={{ width: size - 8, height: size - 8, borderRadius: borderRadius - 4 }}
                resizeMode="cover"
              />
            </View>
          ) : (
            <Image
              source={require("@/assets/images/icon.png")}
              style={{ width: size, height: size, borderRadius }}
              resizeMode="cover"
            />
          )}
        </LinearGradient>

        {/* Pro Crown Badge on the corner */}
        {isPro && (
          <LinearGradient
            colors={["#FFD700", "#F59E0B", "#D97706"]}
            style={[
              styles.crownBadge,
              {
                width: Math.max(18, Math.round(size * 0.35)),
                height: Math.max(18, Math.round(size * 0.35)),
                borderRadius: Math.max(9, Math.round(size * 0.175)),
                top: -Math.round(size * 0.08),
                right: -Math.round(size * 0.08),
              },
            ]}
          >
            <Feather
              name="award"
              size={Math.max(10, Math.round(size * 0.2))}
              color="#FFFFFF"
            />
          </LinearGradient>
        )}
      </View>

      {isPro && showProLabel && (
        <LinearGradient
          colors={["#F59E0B", "#D97706"]}
          style={styles.proLabelPill}
        >
          <Text style={styles.proLabelText}>👑 PRO EDITION</Text>
        </LinearGradient>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  logoWrap: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  innerWrap: {
    flex: 1,
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  proGlow: {
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 6,
  },
  crownBadge: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
    zIndex: 10,
  },
  proLabelPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 2,
  },
  proLabelText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.6,
  },
});
