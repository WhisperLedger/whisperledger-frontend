import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useHousehold } from "@/context/HouseholdContext";
import { useColors } from "@/hooks/useColors";
import { isDarkPalette } from "@/utils/designSystem";
import { safeHaptics } from "@/utils/haptics";

interface Props {
  onOpenHouseholdManage?: () => void;
}

export default function HouseholdSpaceHeader({ onOpenHouseholdManage }: Props) {
  const colors = useColors();
  const isDark = isDarkPalette(colors);
  const { activeSpace, setActiveSpace, currentHousehold, households } = useHousehold();

  const handleSelectSpace = (space: "personal" | "household") => {
    safeHaptics.selectionAsync();
    if (activeSpace === space && space === "household" && onOpenHouseholdManage) {
      onOpenHouseholdManage();
      return;
    }
    setActiveSpace(space);
  };

  const memberCount = Object.keys(currentHousehold?.members || {}).length;
  const flatName = currentHousehold?.name ? currentHousehold.name : "Household";

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.toggleTrack,
          {
            backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
            borderColor: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)",
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.toggleBtn,
            activeSpace === "personal" && [
              styles.toggleBtnActive,
              {
                backgroundColor: colors.card,
                shadowColor: "#000",
                shadowOpacity: isDark ? 0.3 : 0.08,
              },
            ],
          ]}
          onPress={() => handleSelectSpace("personal")}
          activeOpacity={0.8}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeSpace === "personal" }}
          accessibilityLabel="Personal ledger"
        >
          <Feather
            name="user"
            size={14}
            color={activeSpace === "personal" ? colors.primary : colors.mutedForeground}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.toggleText,
              {
                color: activeSpace === "personal" ? colors.foreground : colors.mutedForeground,
                fontFamily: activeSpace === "personal" ? "Inter_600SemiBold" : "Inter_500Medium",
              },
            ]}
          >
            Personal
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.toggleBtn,
            activeSpace === "household" && [
              styles.toggleBtnActive,
              {
                backgroundColor: colors.card,
                shadowColor: "#000",
                shadowOpacity: isDark ? 0.3 : 0.08,
              },
            ],
          ]}
          onPress={() => handleSelectSpace("household")}
          activeOpacity={0.8}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeSpace === "household" }}
          accessibilityLabel={currentHousehold ? `${flatName} household ledger` : "Household ledger"}
        >
          <Feather
            name="home"
            size={14}
            color={activeSpace === "household" ? colors.primary : colors.mutedForeground}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.toggleText,
              {
                color: activeSpace === "household" ? colors.foreground : colors.mutedForeground,
                fontFamily: activeSpace === "household" ? "Inter_600SemiBold" : "Inter_500Medium",
                maxWidth: 130,
              },
            ]}
            numberOfLines={1}
          >
            {flatName}
          </Text>
          {households.length > 1 && activeSpace === "household" && (
            <Feather
              name="chevron-down"
              size={12}
              color={colors.primary}
              style={{ marginLeft: 2 }}
            />
          )}
          {memberCount > 0 && (
            <View
              style={[
                styles.memberCountBadge,
                {
                  backgroundColor: isDark ? "rgba(56, 130, 255, 0.2)" : "rgba(0, 102, 255, 0.12)",
                },
              ]}
            >
              <Text
                style={[
                  styles.memberCountText,
                  { color: colors.primary },
                ]}
              >
                {memberCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    marginBottom: 14,
  },
  toggleTrack: {
    flexDirection: "row",
    alignItems: "center",
    padding: 3,
    borderRadius: 22,
    borderWidth: 1,
    width: "100%",
  },
  toggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
  },
  toggleBtnActive: {
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 3,
  },
  toggleText: {
    fontSize: 13,
  },
  memberCountBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  memberCountText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
});
