import React, { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path, Rect, Text as SvgText } from "react-native-svg";
import { getMerchantMeta } from "@/utils/merchantLogos";

interface MerchantLogoProps {
  merchant: string;
  size?: number;
  borderRadius?: number;
}

export default function MerchantLogo({
  merchant,
  size = 46,
  borderRadius = 14,
}: MerchantLogoProps) {
  const meta = getMerchantMeta(merchant);
  const [imageError, setImageError] = useState(false);

  const clean = merchant.toLowerCase().replace(/[^a-z0-9]/g, "");

  // 1. Vector SVG Brand Emblems for Indian & Global Powerhouse Apps
  const renderVectorBrand = () => {
    if (clean.includes("swiggy")) {
      return (
        <View style={[styles.brandContainer, { backgroundColor: "#FC8019" }]}>
          <Svg width={size * 0.7} height={size * 0.7} viewBox="0 0 100 100">
            <Path
              d="M50 15C33.4 15 20 28.4 20 45c0 22.5 30 40 30 40s30-17.5 30-40c0-16.6-13.4-30-30-30zm0 40c-5.5 0-10-4.5-10-10s4.5-10 10-10 10 4.5 10 10-4.5 10-10 10z"
              fill="#FFFFFF"
            />
          </Svg>
        </View>
      );
    }

    if (clean.includes("zepto")) {
      return (
        <View style={[styles.brandContainer, { backgroundColor: "#3B0764" }]}>
          <Text style={{ color: "#00F0FF", fontSize: Math.round(size * 0.38), fontWeight: "900", fontFamily: "Inter_700Bold" }}>
            z<Text style={{ color: "#FF007A" }}>e</Text><Text style={{ color: "#FAFF00" }}>p</Text><Text style={{ color: "#00F0FF" }}>to</Text>
          </Text>
        </View>
      );
    }

    if (clean.includes("zomato")) {
      return (
        <View style={[styles.brandContainer, { backgroundColor: "#CB202D" }]}>
          <Text style={{ color: "#FFFFFF", fontSize: Math.round(size * 0.32), fontWeight: "900", fontStyle: "italic", fontFamily: "Inter_700Bold", letterSpacing: -0.5 }}>
            zomato
          </Text>
        </View>
      );
    }

    if (clean.includes("blinkit")) {
      return (
        <View style={[styles.brandContainer, { backgroundColor: "#F7C600" }]}>
          <Text style={{ color: "#1E1B4B", fontSize: Math.round(size * 0.35), fontWeight: "900", fontFamily: "Inter_700Bold" }}>
            blink<Text style={{ color: "#10B981" }}>it</Text>
          </Text>
        </View>
      );
    }

    if (clean.includes("amazon")) {
      return (
        <View style={[styles.brandContainer, { backgroundColor: "#232F3E" }]}>
          <Svg width={size * 0.75} height={size * 0.45} viewBox="0 0 100 40">
            <SvgText x="5" y="24" fill="#FFFFFF" fontSize="24" fontWeight="bold" fontFamily="Inter_700Bold">
              amazon
            </SvgText>

            <Path d="M 12 30 Q 50 42 84 26" stroke="#FF9900" strokeWidth="4" fill="none" />
            <Path d="M 80 22 L 87 27 L 82 32 Z" fill="#FF9900" />
          </Svg>
        </View>
      );
    }

    if (clean.includes("flipkart")) {
      return (
        <View style={[styles.brandContainer, { backgroundColor: "#2874F0" }]}>
          <Svg width={size * 0.65} height={size * 0.65} viewBox="0 0 100 100">
            <Path d="M 20 20 L 75 20 L 85 45 L 35 45 Z" fill="#FFE500" />
            <SvgText x="40" y="75" fill="#FFFFFF" fontSize="48" fontWeight="bold" fontFamily="Inter_700Bold">
              f
            </SvgText>
          </Svg>
        </View>
      );
    }

    if (clean.includes("makemytrip") || clean.includes("mmt")) {
      return (
        <View style={[styles.brandContainer, { backgroundColor: "#EB2026" }]}>
          <Text style={{ color: "#FFFFFF", fontSize: Math.round(size * 0.3), fontWeight: "900", fontFamily: "Inter_700Bold" }}>
            mmt
          </Text>
        </View>
      );
    }

    if (clean.includes("uber")) {
      return (
        <View style={[styles.brandContainer, { backgroundColor: "#000000" }]}>
          <Text style={{ color: "#FFFFFF", fontSize: Math.round(size * 0.38), fontWeight: "800", fontFamily: "Inter_700Bold" }}>
            Uber
          </Text>
        </View>
      );
    }

    if (clean.includes("ola")) {
      return (
        <View style={[styles.brandContainer, { backgroundColor: "#7CB342" }]}>
          <Text style={{ color: "#FFFFFF", fontSize: Math.round(size * 0.38), fontWeight: "900", fontFamily: "Inter_700Bold" }}>
            OLA
          </Text>
        </View>
      );
    }

    if (clean.includes("paytm")) {
      return (
        <View style={[styles.brandContainer, { backgroundColor: "#002E6E" }]}>
          <Text style={{ color: "#00B9F1", fontSize: Math.round(size * 0.32), fontWeight: "900", fontFamily: "Inter_700Bold" }}>
            Pay<Text style={{ color: "#FFFFFF" }}>tm</Text>
          </Text>
        </View>
      );
    }

    if (clean.includes("phonepe")) {
      return (
        <View style={[styles.brandContainer, { backgroundColor: "#5F259F" }]}>
          <Text style={{ color: "#FFFFFF", fontSize: Math.round(size * 0.36), fontWeight: "900", fontFamily: "Inter_700Bold" }}>
            पे
          </Text>
        </View>
      );
    }

    if (clean.includes("cred")) {
      return (
        <View style={[styles.brandContainer, { backgroundColor: "#121212" }]}>
          <Text style={{ color: "#FFFFFF", fontSize: Math.round(size * 0.28), fontWeight: "900", letterSpacing: 1.5, fontFamily: "Inter_700Bold" }}>
            CRED
          </Text>
        </View>
      );
    }

    if (clean.includes("netflix")) {
      return (
        <View style={[styles.brandContainer, { backgroundColor: "#141414" }]}>
          <Text style={{ color: "#E50914", fontSize: Math.round(size * 0.52), fontWeight: "900", fontFamily: "Inter_700Bold" }}>
            N
          </Text>
        </View>
      );
    }

    if (clean.includes("spotify")) {
      return (
        <View style={[styles.brandContainer, { backgroundColor: "#1DB954" }]}>
          <Svg width={size * 0.6} height={size * 0.6} viewBox="0 0 100 100">
            <Circle cx="50" cy="50" r="45" fill="#000000" />
            <Path d="M 25 38 Q 50 30 75 42" stroke="#1DB954" strokeWidth="8" fill="none" strokeLinecap="round" />
            <Path d="M 28 52 Q 50 45 72 55" stroke="#1DB954" strokeWidth="7" fill="none" strokeLinecap="round" />
            <Path d="M 32 65 Q 50 60 68 68" stroke="#1DB954" strokeWidth="6" fill="none" strokeLinecap="round" />
          </Svg>
        </View>
      );
    }

    return null;
  };

  const vectorElement = renderVectorBrand();
  if (vectorElement) {
    return (
      <View
        style={[
          styles.outerFrame,
          {
            width: size,
            height: size,
            borderRadius,
          },
        ]}
      >
        {vectorElement}
      </View>
    );
  }

  // 2. Fallback to image or brand emblem badge
  const showImage = !!meta.logoUrl && !imageError;
  const fontSize = Math.round(size * 0.42);

  return (
    <View
      style={[
        styles.outerFrame,
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor: showImage ? "#FFFFFF" : meta.brandColor,
        },
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri: meta.logoUrl }}
          style={[styles.logoImage, { borderRadius: borderRadius - 2 }]}
          onError={() => setImageError(true)}
          resizeMode="contain"
        />
      ) : meta.shortBadge.length > 0 && meta.shortBadge.match(/\p{Emoji}/u) ? (
        <Text style={[styles.emoji, { fontSize }]}>{meta.shortBadge}</Text>
      ) : (
        <View style={styles.textWrap}>
          <Text style={[styles.letter, { color: meta.textColor, fontSize }]}>
            {meta.shortBadge}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  outerFrame: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  brandContainer: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    width: "82%",
    height: "82%",
  },
  emoji: {
    textAlign: "center",
  },
  textWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  letter: {
    fontFamily: "Inter_700Bold",
    fontWeight: "700",
  },
});
