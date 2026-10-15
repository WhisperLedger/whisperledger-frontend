/**
 * Merchant identity resolver.
 *
 * A merchant name is often all we receive from an SMS or a manually added
 * transaction. Keep the decision here (rather than in individual screens) so
 * every place in the product identifies a merchant in exactly the same way.
 * Recognised brands use the favicon served for their verified public domain;
 * all other merchants deliberately fall back to initials.
 */
export interface MerchantMeta {
  name: string;
  brandColor: string;
  textColor: string;
  logoUrl?: string;
  initials: string;
  isKnownMerchant: boolean;
}

interface MerchantDefinition {
  name: string;
  domain: string;
  aliases: string[];
  brandColor: string;
  textColor?: string;
}

const MERCHANTS: MerchantDefinition[] = [
  { name: "Swiggy", domain: "swiggy.com", aliases: ["swiggy", "instamart"], brandColor: "#FC8019" },
  { name: "Zomato", domain: "zomato.com", aliases: ["zomato", "zomaland"], brandColor: "#E23744" },
  { name: "Zepto", domain: "zeptonow.com", aliases: ["zepto", "zeptonow"], brandColor: "#3B1464" },
  { name: "Blinkit", domain: "blinkit.com", aliases: ["blinkit", "grofers"], brandColor: "#F7C600", textColor: "#1E293B" },
  { name: "BigBasket", domain: "bigbasket.com", aliases: ["bigbasket", "big basket", "bbnow"], brandColor: "#84C225", textColor: "#183A11" },
  { name: "JioMart", domain: "jiomart.com", aliases: ["jiomart", "jio mart"], brandColor: "#0B3B8C" },
  { name: "Amazon", domain: "amazon.in", aliases: ["amazon", "amzn"], brandColor: "#232F3E" },
  { name: "Flipkart", domain: "flipkart.com", aliases: ["flipkart", "flip kart"], brandColor: "#2874F0" },
  { name: "Myntra", domain: "myntra.com", aliases: ["myntra"], brandColor: "#E50046" },
  { name: "Meesho", domain: "meesho.com", aliases: ["meesho"], brandColor: "#9F2089" },
  { name: "Uber", domain: "uber.com", aliases: ["uber"], brandColor: "#111111" },
  { name: "Ola", domain: "olacabs.com", aliases: ["olacabs", "ola cabs", "ola"], brandColor: "#3A7D44" },
  { name: "Rapido", domain: "rapido.bike", aliases: ["rapido"], brandColor: "#F9C900", textColor: "#1F2937" },
  { name: "MakeMyTrip", domain: "makemytrip.com", aliases: ["makemytrip", "make my trip", "mmt"], brandColor: "#EB2026" },
  { name: "Goibibo", domain: "goibibo.com", aliases: ["goibibo"], brandColor: "#EF5323" },
  { name: "BookMyShow", domain: "bookmyshow.com", aliases: ["bookmyshow", "book my show"], brandColor: "#F84464" },
  { name: "PVR INOX", domain: "pvrcinemas.com", aliases: ["pvr", "inox"], brandColor: "#C6953D" },
  { name: "Starbucks", domain: "starbucks.in", aliases: ["starbucks"], brandColor: "#00754A" },
  { name: "McDonald's", domain: "mcdonalds.com", aliases: ["mcdonald", "mc donald"], brandColor: "#DA291C" },
  { name: "Domino's", domain: "dominos.co.in", aliases: ["dominos", "domino's"], brandColor: "#006491" },
  { name: "KFC", domain: "kfc.co.in", aliases: ["kfc"], brandColor: "#E4002B" },
  { name: "Netflix", domain: "netflix.com", aliases: ["netflix"], brandColor: "#141414" },
  { name: "Spotify", domain: "spotify.com", aliases: ["spotify"], brandColor: "#1DB954", textColor: "#102A1D" },
  { name: "Google Play", domain: "play.google.com", aliases: ["google play", "googleplay"], brandColor: "#4285F4" },
  { name: "Apple", domain: "apple.com", aliases: ["apple.com", "apple services", "apple service"], brandColor: "#1D1D1F" },
  { name: "PhonePe", domain: "phonepe.com", aliases: ["phonepe", "phone pe"], brandColor: "#5F259F" },
  { name: "Paytm", domain: "paytm.com", aliases: ["paytm", "pay tm"], brandColor: "#002E6E" },
  { name: "Google Pay", domain: "pay.google.com", aliases: ["google pay", "gpay", "g pay"], brandColor: "#4285F4" },
  { name: "CRED", domain: "cred.club", aliases: ["cred"], brandColor: "#151515" },
  { name: "Reliance Jio", domain: "jio.com", aliases: ["reliance jio", "jio"], brandColor: "#0A2885" },
  { name: "Airtel", domain: "airtel.in", aliases: ["airtel"], brandColor: "#E40000" },
  { name: "Vi", domain: "myvi.in", aliases: ["vodafone idea", "vodafone", "myvi", "vi"], brandColor: "#E31E24" },
];

function normalise(value: string): string {
  return value.toLocaleLowerCase("en-IN").replace(/[^a-z0-9]+/g, " ").trim();
}

function getInitials(name?: string): string {
  const words = normalise(name || "merchant").split(" ").filter(Boolean);
  if (!words.length) return "M";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function fallbackColor(name: string): string {
  const palette = ["#334155", "#155E75", "#3F3CBB", "#9F1239", "#9A3412", "#166534"];
  const hash = Array.from(name).reduce((total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0, 7);
  return palette[hash % palette.length];
}

function faviconFor(domain: string): string {
  // Fetches the icon exposed by the merchant's own domain. No user account,
  // credential, or manual logo selection is involved.
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
}

export function getMerchantMeta(merchantName?: string): MerchantMeta {
  const originalName = merchantName?.trim() || "Merchant";
  const query = ` ${normalise(originalName)} `;
  const match = MERCHANTS.find((merchant) =>
    merchant.aliases.some((alias) => query.includes(` ${normalise(alias)} `)),
  );

  if (!match) {
    return {
      name: originalName,
      brandColor: fallbackColor(originalName),
      textColor: "#FFFFFF",
      initials: getInitials(originalName),
      isKnownMerchant: false,
    };
  }

  return {
    name: match.name,
    brandColor: match.brandColor,
    textColor: match.textColor || "#FFFFFF",
    logoUrl: faviconFor(match.domain),
    initials: getInitials(match.name),
    isKnownMerchant: true,
  };
}
