/**
 * Centralised client configuration. EXPO_PUBLIC_* values are intentionally
 * non-secret: they are embedded in the mobile bundle. Keep credentials and
 * service-account keys on the backend only.
 */
export type DataBackend = "firebase" | "api";

function readBackend(): DataBackend {
  const value = process.env.EXPO_PUBLIC_DATA_BACKEND || "firebase";
  if (value === "firebase" || value === "api") return value;
  throw new Error("EXPO_PUBLIC_DATA_BACKEND must be either 'firebase' or 'api'.");
}

function normalizeApiUrl(value?: string) {
  return value?.trim().replace(/\/+$/, "") || "";
}

export const runtimeConfig = Object.freeze({
  dataBackend: readBackend(),
  apiBaseUrl: normalizeApiUrl(process.env.EXPO_PUBLIC_API_URL),
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN || "",
});

export function requireApiBaseUrl() {
  if (!runtimeConfig.apiBaseUrl) {
    throw new Error("EXPO_PUBLIC_API_URL is required when EXPO_PUBLIC_DATA_BACKEND=api.");
  }
  return runtimeConfig.apiBaseUrl;
}
