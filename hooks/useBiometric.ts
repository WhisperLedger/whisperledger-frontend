import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import { Platform } from "react-native";

export const BIOMETRIC_PREF_KEY = "@whisperledger_biometric_enabled";

export interface BiometricResult {
  success: boolean;
  error?: string;
}

/**
 * Check if the device supports biometric authentication and has enrolled biometrics.
 */
export async function checkBiometricAvailable(): Promise<{
  available: boolean;
  biometricType: "fingerprint" | "faceId" | "iris" | "none";
}> {
  if (Platform.OS === "web") {
    return { available: false, biometricType: "none" };
  }

  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return { available: false, biometricType: "none" };

    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!isEnrolled) return { available: false, biometricType: "none" };

    const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

    let biometricType: "fingerprint" | "faceId" | "iris" | "none" = "none";
    if (
      supportedTypes.includes(
        LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION
      )
    ) {
      biometricType = "faceId";
    } else if (
      supportedTypes.includes(
        LocalAuthentication.AuthenticationType.FINGERPRINT
      )
    ) {
      biometricType = "fingerprint";
    } else if (
      supportedTypes.includes(
        LocalAuthentication.AuthenticationType.IRIS
      )
    ) {
      biometricType = "iris";
    }

    return { available: true, biometricType };
  } catch (e) {
    console.warn("[Biometric] Hardware check failed:", e);
    return { available: false, biometricType: "none" };
  }
}

/**
 * Check if the user has enabled biometric lock in WhisperLedger settings.
 * Defaults to false (no biometrics unless registered/enabled by user).
 */
export async function isBiometricEnabled(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const val = await AsyncStorage.getItem(BIOMETRIC_PREF_KEY);
    return val === "true";
  } catch {
    return false;
  }
}

/**
 * Set biometric enabled/disabled in storage.
 */
export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await AsyncStorage.setItem(BIOMETRIC_PREF_KEY, enabled ? "true" : "false");
  } catch (e) {
    console.warn("[Biometric] Failed to save biometric preference:", e);
  }
}

/**
 * Prompt the user for biometric authentication.
 * Falls back to device PIN/Pattern/Password if biometrics fail.
 */
export async function authenticateWithBiometrics(
  reason = "Unlock WhisperLedger to access your finances"
): Promise<BiometricResult> {
  if (Platform.OS === "web") {
    return { success: true }; // Always pass on web
  }

  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: "Cancel",
      disableDeviceFallback: false, // Allow PIN fallback
      fallbackLabel: "Use PIN",
    });

    if (result.success) {
      return { success: true };
    } else {
      return {
        success: false,
        error:
          result.error === "user_cancel"
            ? "Authentication cancelled"
            : result.error === "not_enrolled"
            ? "No biometrics enrolled"
            : "Authentication failed",
      };
    }
  } catch (e: any) {
    console.warn("[Biometric] Authentication error:", e);
    return { success: false, error: e?.message || "Authentication error" };
  }
}

/**
 * Registers biometric authentication for the first time.
 * Verifies hardware & enrolled status, prompts biometric scan, and saves preference only on success.
 */
export async function registerBiometrics(): Promise<BiometricResult> {
  if (Platform.OS === "web") {
    return { success: false, error: "Biometrics not supported on web" };
  }

  const { available, biometricType } = await checkBiometricAvailable();
  if (!available) {
    return {
      success: false,
      error: "No biometric sensor or enrolled fingerprint/face found on this device. Please set up fingerprint or Face ID in device settings.",
    };
  }

  const label =
    biometricType === "faceId"
      ? "Face ID"
      : biometricType === "iris"
      ? "Iris Recognition"
      : "Fingerprint";

  const authResult = await authenticateWithBiometrics(
    `Verify your ${label} to enable Biometric Lock`
  );

  if (authResult.success) {
    await setBiometricEnabled(true);
    return { success: true };
  } else {
    return authResult;
  }
}
