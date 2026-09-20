import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface Props {
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export default function ProBadge({ size = "sm", showLabel = true }: Props) {
  const isSmall = size === "sm";
  const isLarge = size === "lg";

  return (
    <LinearGradient
      colors={["#F59E0B", "#D97706", "#B45309"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.badgeWrap,
        isSmall && styles.badgeSm,
        isLarge && styles.badgeLg,
      ]}
    >
      <Feather
        name="award"
        size={isSmall ? 9 : isLarge ? 14 : 11}
        color="#FFFFFF"
      />
      {showLabel && (
        <Text
          style={[
            styles.badgeText,
            isSmall && styles.textSm,
            isLarge && styles.textLg,
          ]}
        >
          PRO
        </Text>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  badgeWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  badgeSm: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  badgeLg: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 10,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 9.5,
    fontFamily: "Inter_700Bold",
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  textSm: {
    fontSize: 8.5,
    letterSpacing: 0.4,
  },
  textLg: {
    fontSize: 11,
    letterSpacing: 0.8,
  },
});
