import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { isDarkPalette } from "@/utils/designSystem";

interface FormattedErrorMessageProps {
  title?: string;
  message: string;
  onDismiss?: () => void;
  style?: any;
}

export default function FormattedErrorMessage({
  title,
  message,
  onDismiss,
  style,
}: FormattedErrorMessageProps) {
  const colors = useColors();
  const isDark = isDarkPalette(colors);

  if (!message) return null;

  // Auto-detect title from common patterns if not explicitly provided
  let displayTitle = title;
  if (!displayTitle) {
    const lower = message.toLowerCase();
    if (lower.includes("password") || lower.includes("credential")) {
      displayTitle = "Authentication Issue";
    } else if (lower.includes("email") || lower.includes("account")) {
      displayTitle = "Account Notice";
    } else if (lower.includes("network") || lower.includes("connect")) {
      displayTitle = "Connection Problem";
    } else if (lower.includes("amount") || lower.includes("valid")) {
      displayTitle = "Input Required";
    } else {
      displayTitle = "Action Needed";
    }
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? "rgba(239, 68, 68, 0.12)" : "#FEF2F2",
          borderColor: isDark ? "rgba(239, 68, 68, 0.35)" : "#FCA5A5",
        },
        style,
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          {
            backgroundColor: isDark ? "rgba(239, 68, 68, 0.20)" : "#FEE2E2",
          },
        ]}
      >
        <Feather name="alert-circle" size={16} color={isDark ? "#F87171" : "#DC2626"} />
      </View>

      <View style={styles.textWrap}>
        {displayTitle ? (
          <Text style={[styles.title, { color: isDark ? "#FCA5A5" : "#991B1B" }]}>
            {displayTitle}
          </Text>
        ) : null}
        <Text style={[styles.message, { color: isDark ? "#FECACA" : "#B91C1C" }]}>
          {message}
        </Text>
      </View>

      {onDismiss && (
        <TouchableOpacity
          onPress={onDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.dismissBtn}
        >
          <Feather name="x" size={14} color={isDark ? "#FCA5A5" : "#991B1B"} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 4,
    marginVertical: 10,
    gap: 10,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    marginBottom: 2,
  },
  message: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Inter_400Regular",
  },
  dismissBtn: {
    padding: 2,
    marginLeft: 4,
    marginTop: 2,
  },
});
