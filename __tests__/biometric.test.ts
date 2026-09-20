jest.mock("react-native", () => ({
  Platform: { OS: "android" },
}));

jest.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map<string, string>();
  return {
    getItem: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    clear: jest.fn(() => {
      store.clear();
      return Promise.resolve();
    }),
  };
});

jest.mock("expo-local-authentication", () => ({
  hasHardwareAsync: jest.fn(() => Promise.resolve(true)),
  isEnrolledAsync: jest.fn(() => Promise.resolve(true)),
  supportedAuthenticationTypesAsync: jest.fn(() => Promise.resolve([1])), // 1 = FINGERPRINT
  authenticateAsync: jest.fn(() => Promise.resolve({ success: true })),
  AuthenticationType: {
    FINGERPRINT: 1,
    FACIAL_RECOGNITION: 2,
    IRIS: 3,
  },
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  isBiometricEnabled,
  setBiometricEnabled,
  registerBiometrics,
  BIOMETRIC_PREF_KEY,
} from "../hooks/useBiometric";

describe("Biometric Security Management", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  test("biometrics are disabled by default (no biometric prompt)", async () => {
    const enabled = await isBiometricEnabled();
    expect(enabled).toBe(false);
  });

  test("registerBiometrics verifies hardware, prompts auth, and enables biometric lock on success", async () => {
    const res = await registerBiometrics();
    expect(res.success).toBe(true);

    const enabled = await isBiometricEnabled();
    expect(enabled).toBe(true);
  });

  test("can disable biometric lock in preferences", async () => {
    await setBiometricEnabled(true);
    expect(await isBiometricEnabled()).toBe(true);

    await setBiometricEnabled(false);
    expect(await isBiometricEnabled()).toBe(false);
  });
});
