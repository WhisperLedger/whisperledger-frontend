/**
 * Realistic Brand & Merchant Logo Mapping Engine
 * Maps merchant names to official brand colors, CDN logo URLs, and emblems.
 */

export interface MerchantMeta {
  name: string;
  brandColor: string;
  textColor: string;
  logoUrl?: string;
  fallbackIcon: string; // Feather icon or emoji mark
  shortBadge: string;
}

const BRAND_DATABASE: Record<string, MerchantMeta> = {
  swiggy: {
    name: "Swiggy",
    brandColor: "#FC8019",
    textColor: "#FFFFFF",
    logoUrl: "https://logo.clearbit.com/swiggy.com",
    fallbackIcon: "shopping-bag",
    shortBadge: "🍔",
  },
  zomato: {
    name: "Zomato",
    brandColor: "#CB202D",
    textColor: "#FFFFFF",
    logoUrl: "https://logo.clearbit.com/zomato.com",
    fallbackIcon: "coffee",
    shortBadge: "🍕",
  },
  zepto: {
    name: "Zepto",
    brandColor: "#7E22CE",
    textColor: "#FFFFFF",
    logoUrl: "https://logo.clearbit.com/zeptonow.com",
    fallbackIcon: "zap",
    shortBadge: "⚡",
  },
  blinkit: {
    name: "Blinkit",
    brandColor: "#F7C600",
    textColor: "#1E1B4B",
    logoUrl: "https://logo.clearbit.com/blinkit.com",
    fallbackIcon: "shopping-cart",
    shortBadge: "🛒",
  },
  amazon: {
    name: "Amazon",
    brandColor: "#232F3E",
    textColor: "#FF9900",
    logoUrl: "https://logo.clearbit.com/amazon.in",
    fallbackIcon: "package",
    shortBadge: "📦",
  },
  flipkart: {
    name: "Flipkart",
    brandColor: "#2874F0",
    textColor: "#FFE500",
    logoUrl: "https://logo.clearbit.com/flipkart.com",
    fallbackIcon: "shopping-cart",
    shortBadge: "🛍️",
  },
  makemytrip: {
    name: "MakeMyTrip",
    brandColor: "#EB2026",
    textColor: "#FFFFFF",
    logoUrl: "https://logo.clearbit.com/makemytrip.com",
    fallbackIcon: "navigation",
    shortBadge: "✈️",
  },
  goibibo: {
    name: "Goibibo",
    brandColor: "#EC5B24",
    textColor: "#FFFFFF",
    logoUrl: "https://logo.clearbit.com/goibibo.com",
    fallbackIcon: "compass",
    shortBadge: "🏨",
  },
  uber: {
    name: "Uber",
    brandColor: "#000000",
    textColor: "#FFFFFF",
    logoUrl: "https://logo.clearbit.com/uber.com",
    fallbackIcon: "truck",
    shortBadge: "🚗",
  },
  ola: {
    name: "Ola Cabs",
    brandColor: "#7CB342",
    textColor: "#FFFFFF",
    logoUrl: "https://logo.clearbit.com/olacabs.com",
    fallbackIcon: "navigation",
    shortBadge: "🚕",
  },
  starbucks: {
    name: "Starbucks",
    brandColor: "#00704A",
    textColor: "#FFFFFF",
    logoUrl: "https://logo.clearbit.com/starbucks.com",
    fallbackIcon: "coffee",
    shortBadge: "☕",
  },
  bookmyshow: {
    name: "BookMyShow",
    brandColor: "#F84464",
    textColor: "#FFFFFF",
    logoUrl: "https://logo.clearbit.com/bookmyshow.com",
    fallbackIcon: "film",
    shortBadge: "🎟️",
  },
  netflix: {
    name: "Netflix",
    brandColor: "#E50914",
    textColor: "#FFFFFF",
    logoUrl: "https://logo.clearbit.com/netflix.com",
    fallbackIcon: "tv",
    shortBadge: "🎬",
  },
  spotify: {
    name: "Spotify",
    brandColor: "#1DB954",
    textColor: "#FFFFFF",
    logoUrl: "https://logo.clearbit.com/spotify.com",
    fallbackIcon: "music",
    shortBadge: "🎵",
  },
  bigbasket: {
    name: "BigBasket",
    brandColor: "#689F38",
    textColor: "#FFFFFF",
    logoUrl: "https://logo.clearbit.com/bigbasket.com",
    fallbackIcon: "shopping-bag",
    shortBadge: "🧺",
  },
  myntra: {
    name: "Myntra",
    brandColor: "#E40046",
    textColor: "#FFFFFF",
    logoUrl: "https://logo.clearbit.com/myntra.com",
    fallbackIcon: "tag",
    shortBadge: "👗",
  },
  urbancompany: {
    name: "Urban Company",
    brandColor: "#1E293B",
    textColor: "#38BDF8",
    logoUrl: "https://logo.clearbit.com/urbancompany.com",
    fallbackIcon: "tool",
    shortBadge: "🛠️",
  },
  paytm: {
    name: "Paytm",
    brandColor: "#002E6E",
    textColor: "#00B9F1",
    logoUrl: "https://logo.clearbit.com/paytm.com",
    fallbackIcon: "credit-card",
    shortBadge: "💳",
  },
  phonepe: {
    name: "PhonePe",
    brandColor: "#5F259F",
    textColor: "#FFFFFF",
    logoUrl: "https://logo.clearbit.com/phonepe.com",
    fallbackIcon: "dollar-sign",
    shortBadge: "🟣",
  },
  gpay: {
    name: "Google Pay",
    brandColor: "#1A73E8",
    textColor: "#FFFFFF",
    logoUrl: "https://logo.clearbit.com/pay.google.com",
    fallbackIcon: "check-circle",
    shortBadge: "🔵",
  },
  cred: {
    name: "CRED",
    brandColor: "#121212",
    textColor: "#F8FAFC",
    logoUrl: "https://logo.clearbit.com/cred.club",
    fallbackIcon: "shield",
    shortBadge: "💳",
  },
};

/**
 * Normalizes merchant query and extracts matching brand metadata.
 */
export function getMerchantMeta(merchantName?: string): MerchantMeta {
  if (!merchantName) {
    return {
      name: "Merchant",
      brandColor: "#6366F1",
      textColor: "#FFFFFF",
      fallbackIcon: "shopping-bag",
      shortBadge: "🏷️",
    };
  }

  const clean = merchantName.toLowerCase().replace(/[^a-z0-9]/g, "");

  for (const key of Object.keys(BRAND_DATABASE)) {
    if (clean.includes(key) || key.includes(clean)) {
      return BRAND_DATABASE[key];
    }
  }

  // Generate deterministic brand tint from merchant string hash for unknown merchants
  let hash = 0;
  for (let i = 0; i < merchantName.length; i++) {
    hash = merchantName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;

  return {
    name: merchantName,
    brandColor: `hsl(${hue}, 65%, 45%)`,
    textColor: "#FFFFFF",
    fallbackIcon: "shopping-bag",
    shortBadge: merchantName.charAt(0).toUpperCase(),
  };
}
