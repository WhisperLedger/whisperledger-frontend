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
          <Svg width={size * 0.65} height={size * 0.65} viewBox="0 0 100 100">
            <Path
              d="M 50 10 C 33 10 20 23 20 40 C 20 58 35 72 50 90 C 50 90 50 90 50 90 C 52 87 56 82 60 77 C 48 67 40 57 40 45 C 40 37 45 31 50 31 C 56 31 60 36 60 43 C 60 50 54 54 48 57 C 44 59 38 61 34 64 L 40 73 C 46 68 55 65 62 61 C 71 56 77 47 77 36 C 77 21 65 10 50 10 Z"
              fill="#FFFFFF"
            />
          </Svg>
        </View>
      );
    }

    if (clean.includes("zepto")) {
      return (
        <View style={[styles.brandContainer, { backgroundColor: "#3B0764" }]}>
          <Svg width={size * 0.8} height={size * 0.45} viewBox="0 0 120 40">
            <SvgText x="5" y="30" fill="#00F0FF" fontSize="28" fontWeight="900" fontFamily="Inter_700Bold">
              z<SvgText fill="#FF007A">e</SvgText><SvgText fill="#FAFF00">p</SvgText><SvgText fill="#00F0FF">to</SvgText>
            </SvgText>
          </Svg>
        </View>
      );
    }

    if (clean.includes("zomato")) {
      return (
        <View style={[styles.brandContainer, { backgroundColor: "#CB202D" }]}>
          <Svg width={size * 0.8} height={size * 0.4} viewBox="0 0 120 40">
            <SvgText x="5" y="28" fill="#FFFFFF" fontSize="26" fontWeight="900" fontStyle="italic" fontFamily="Inter_700Bold">
              zomato
            </SvgText>
          </Svg>
        </View>
      );
    }

    if (clean.includes("blinkit")) {
      return (
        <View style={[styles.brandContainer, { backgroundColor: "#F7C600" }]}>
          <Svg width={size * 0.8} height={size * 0.4} viewBox="0 0 120 40">
            <SvgText x="5" y="28" fill="#1E1B4B" fontSize="26" fontWeight="900" fontFamily="Inter_700Bold">
              blink<SvgText fill="#10B981">it</SvgText>
            </SvgText>
          </Svg>
        </View>
      );
    }

    if (clean.includes("amazon")) {
      return (
        <View style={[styles.brandContainer, { backgroundColor: "#232F3E" }]}>
          <Svg width={size * 0.78} height={size * 0.45} viewBox="0 0 100 40">
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

    if (clean.includes("starbucks")) {
      return (
        <View style={[styles.brandContainer, { backgroundColor: "#00704A" }]}>
          <Svg width={size * 0.65} height={size * 0.65} viewBox="0 0 100 100">
            <Circle cx="50" cy="50" r="44" fill="#00704A" stroke="#FFFFFF" strokeWidth="4" />
            <Circle cx="50" cy="50" r="30" fill="none" stroke="#FFFFFF" strokeWidth="3" />
            <Path d="M 50 22 L 53 32 L 62 32 L 55 38 L 58 48 L 50 42 L 42 48 L 45 38 L 38 32 L 47 32 Z" fill="#FFFFFF" />
          </Svg>
        </View>
      );
    }

    if (clean.includes("dunzo")) {
      return (
        <View style={[styles.brandContainer, { backgroundColor: "#00D290" }]}>
          <Svg width={size * 0.65} height={size * 0.65} viewBox="0 0 100 100">
            <Path d="M 30 20 L 55 20 C 70 20 80 30 80 50 C 80 70 70 80 55 80 L 30 80 Z" fill="#1E1B4B" />
            <Path d="M 55 35 L 42 52 L 52 52 L 45 68 L 65 48 L 54 48 Z" fill="#00D290" />
          </Svg>
        </View>
      );
    }

    if (clean.includes("myntra")) {
      return (
        <View style={[styles.brandContainer, { backgroundColor: "#FFFFFF" }]}>
          <Svg width={size * 0.65} height={size * 0.65} viewBox="0 0 100 100">
            <Path d="M 15 75 L 35 25 L 50 55 L 65 25 L 85 75" stroke="#E40046" strokeWidth="16" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M 35 25 L 50 55 L 65 25" stroke="#FF9900" strokeWidth="12" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>
      );
    }

    if (clean.includes("jio")) {
      return (
        <View style={[styles.brandContainer, { backgroundColor: "#0A2885" }]}>
          <Svg width={size * 0.65} height={size * 0.65} viewBox="0 0 100 100">
            <Circle cx="50" cy="50" r="42" fill="#E11B22" />
            <SvgText x="22" y="62" fill="#FFFFFF" fontSize="36" fontWeight="900" fontFamily="Inter_700Bold">
              Jio
            </SvgText>
          </Svg>
        </View>
      );
    }

    if (clean.includes("airtel")) {
      return (
        <View style={[styles.brandContainer, { backgroundColor: "#E40000" }]}>
          <Svg width={size * 0.65} height={size * 0.65} viewBox="0 0 100 100">
            <Path d="M 30 75 C 30 35 70 35 70 75 C 70 55 50 45 30 75 Z" fill="#FFFFFF" />
            <Circle cx="70" cy="30" r="8" fill="#FFFFFF" />
          </Svg>
        </View>
      );
    }

    if (clean.includes("makemytrip") || clean.includes("mmt")) {
      return (
        <View style={[styles.brandContainer, { backgroundColor: "#EB2026" }]}>
          <Text style={{ color: "#FFFFFF", fontSize: Math.round(size * 0.32), fontWeight: "900", fontFamily: "Inter_700Bold" }}>
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
    borderColor: "rgba(0, 0, 0, 0.08)",
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
