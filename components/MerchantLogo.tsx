import React, { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { getMerchantMeta } from "@/utils/merchantLogos";

interface MerchantLogoProps {
  merchant: string;
  size?: number;
  borderRadius?: number;
}

/**
 * A display-only merchant identity. Users never choose a logo: a recognised
 * merchant gets its public-domain icon and an unknown merchant gets initials.
 */
export default function MerchantLogo({
  merchant,
  size = 46,
  borderRadius = 14,
}: MerchantLogoProps) {
  const meta = getMerchantMeta(merchant);
  const [imageError, setImageError] = useState(false);

  // Expense rows are virtualised, so clear a previous image failure when their
  // merchant changes instead of incorrectly retaining the initials fallback.
  useEffect(() => setImageError(false), [merchant]);

  const showLogo = Boolean(meta.logoUrl) && !imageError;
  const fontSize = Math.max(11, Math.round(size * (meta.initials.length > 1 ? 0.31 : 0.42)));

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`${meta.name} merchant identity`}
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor: showLogo ? "#FFFFFF" : meta.brandColor,
        },
      ]}
    >
      {showLogo ? (
        <Image
          source={{ uri: meta.logoUrl }}
          style={[styles.logo, { borderRadius: Math.max(4, borderRadius - 3) }]}
          onError={() => setImageError(true)}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Text style={[styles.initials, { color: meta.textColor, fontSize }]}>{meta.initials}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.10)",
  },
  logo: {
    width: "72%",
    height: "72%",
  },
  initials: {
    fontFamily: "Inter_700Bold",
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});
