import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  AppState,
  AppStateStatus,
  Image,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import {
  authenticateWithBiometrics,
  checkBiometricAvailable,
} from "@/hooks/useBiometric";

interface BiometricGateProps {
  children: React.ReactNode;
}

export function BiometricGate({ children }: BiometricGateProps) {
  const { user, login, logout } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [isUnlocked, setIsUnlocked] = useState(!user);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<
    "fingerprint" | "faceId" | "iris" | "none"
  >("none");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [checkingHardware, setCheckingHardware] = useState(!!user);

  // Password Fallback Modal state
  const [showPasswordFallback, setShowPasswordFallback] = useState(false);
  const [fallbackPassword, setFallbackPassword] = useState("");
  const [fallbackLoading, setFallbackLoading] = useState(false);
  const [fallbackError, setFallbackError] = useState("");

  // Animations
  const lockOpacity = useRef(new Animated.Value(1)).current;
  const lockScale = useRef(new Animated.Value(1)).current;
  const iconPulse = useRef(new Animated.Value(1)).current;
  const appState = useRef(AppState.currentState);
  const lastUnlockedAt = useRef<number>(0);
  const RELOCK_GRACE_MS = 30_000;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(iconPulse, {
          toValue: 1.08,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(iconPulse, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  useEffect(() => {
    let active = true;

    const timer = setTimeout(() => {
      if (active && checkingHardware) {
        console.warn("[Biometric] Safety timeout triggered - bypassing biometric check");
        setCheckingHardware(false);
        setIsUnlocked(true);
      }
    }, 1200);

    checkBiometricAvailable()
      .then(({ available, biometricType: bt }) => {
        clearTimeout(timer);
        if (!active) return;

        setBiometricAvailable(available);
        setBiometricType(bt);
        setCheckingHardware(false);

        if (!available) {
          setIsUnlocked(true);
        } else {
          if (user) {
            setTimeout(() => {
              if (active) triggerAuth(available);
            }, 400);
          } else {
            setIsUnlocked(true);
          }
        }
      })
      .catch((err) => {
        clearTimeout(timer);
        console.warn("[Biometric] checkBiometricAvailable failed, bypassing:", err);
        if (active) {
          setCheckingHardware(false);
          setIsUnlocked(true);
        }
      });

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setIsUnlocked(true);
    }
  }, [user]);

  useEffect(() => {
    const sub = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        if (
          appState.current === "active" &&
          (nextState === "background" || nextState === "inactive")
        ) {
          lastUnlockedAt.current = Date.now();
        } else if (
          (appState.current === "background" ||
            appState.current === "inactive") &&
          nextState === "active"
        ) {
          const elapsed = Date.now() - lastUnlockedAt.current;
          if (elapsed > RELOCK_GRACE_MS && biometricAvailable) {
            setIsUnlocked(false);
            setTimeout(() => triggerAuth(biometricAvailable), 200);
          }
        }
        appState.current = nextState;
      }
    );
    return () => sub.remove();
  }, [biometricAvailable]);

  const triggerAuth = useCallback(async (available: boolean) => {
    if (!available) {
      setIsUnlocked(true);
      return;
    }
    if (isAuthenticating) return;

    setIsAuthenticating(true);
    const result = await authenticateWithBiometrics(
      "Touch the fingerprint sensor to unlock WhisperLedger"
    );
    setIsAuthenticating(false);

    if (result.success) {
      Animated.parallel([
        Animated.timing(lockOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(lockScale, {
          toValue: 0.96,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => setIsUnlocked(true));
    }
  }, [isAuthenticating, lockOpacity, lockScale]);

  const handleUnlockPress = () => {
    triggerAuth(biometricAvailable);
  };

  const handlePasswordUnlock = async () => {
    if (!user || !fallbackPassword.trim()) {
      setFallbackError("Please enter your account password.");
      return;
    }

    setFallbackLoading(true);
    setFallbackError("");
    const res = await login(user.username || user.email, fallbackPassword);
    setFallbackLoading(false);

    if (res.success) {
      setShowPasswordFallback(false);
      setIsUnlocked(true);
    } else {
      setFallbackError("Incorrect password. Please try again.");
    }
  };

  if (isUnlocked) return <>{children}</>;

  return (
    <>
      {children}
      <Animated.View
        style={[
          styles.overlay,
          { opacity: lockOpacity, transform: [{ scale: lockScale }] },
        ]}
      >
        <LinearGradient
          colors={["#0F172A", "#1E1B4B", "#0B0D18"]}
          style={styles.gradient}
        >
          <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
            {/* Logo */}
            <View style={styles.logoWrap}>
              <Image
                source={require("../assets/images/icon.png")}
                style={styles.logo}
              />
            </View>

            <Text style={styles.appName}>WhisperLedger</Text>
            <Text style={styles.subtitle}>Touch sensor or enter passcode to unlock</Text>

            {/* Biometric Icon Scanner Button */}
            <TouchableOpacity
              onPress={handleUnlockPress}
              activeOpacity={0.75}
              disabled={isAuthenticating}
              style={styles.biometricButton}
            >
              <Animated.View
                style={[
                  styles.biometricIconWrap,
                  { transform: [{ scale: iconPulse }] },
                ]}
              >
                <LinearGradient
                  colors={["rgba(99,102,241,0.25)", "rgba(16,185,129,0.18)"]}
                  style={styles.biometricGradient}
                >
                  <Feather
                    name={"shield" as any}
                    size={48}
                    color="#818CF8"
                  />
                </LinearGradient>
              </Animated.View>
            </TouchableOpacity>

            <Text style={styles.unlockLabel}>
              {isAuthenticating
                ? "Scanning Biometrics…"
                : biometricType === "faceId"
                ? "Tap to scan Face ID"
                : "Tap to scan Fingerprint"}
            </Text>

            <Text style={styles.hint}>
              Supports Fingerprint, Face ID & Device PIN
            </Text>

            {/* Explicit Fallback Actions */}
            <View style={styles.fallbackActionsWrap}>
              <TouchableOpacity
                onPress={() => setShowPasswordFallback(true)}
                style={styles.fallbackPinBtn}
                activeOpacity={0.8}
              >
                <Feather name="key" size={16} color="#A5B4FC" style={{ marginRight: 8 }} />
                <Text style={styles.fallbackPinText}>Use Account Password</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={async () => {
                  try {
                    await logout();
                    setIsUnlocked(true);
                  } catch (e) {
                    Alert.alert("Error", "Failed to sign out");
                  }
                }}
                style={styles.logoutButton}
                activeOpacity={0.7}
              >
                <Text style={styles.logoutText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>

        {/* Password Fallback Modal */}
        <Modal
          visible={showPasswordFallback}
          animationType="slide"
          transparent
          onRequestClose={() => setShowPasswordFallback(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Enter Password to Unlock</Text>
                <TouchableOpacity onPress={() => setShowPasswordFallback(false)}>
                  <Feather name="x" size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSub}>
                Confirm password for account ({user?.email || user?.username})
              </Text>

              <TextInput
                style={styles.modalInput}
                placeholder="Enter password"
                placeholderTextColor="#64748B"
                secureTextEntry
                value={fallbackPassword}
                onChangeText={setFallbackPassword}
              />

              {!!fallbackError && (
                <Text style={styles.modalError}>{fallbackError}</Text>
              )}

              <TouchableOpacity
                style={styles.modalUnlockBtn}
                onPress={handlePasswordUnlock}
                disabled={fallbackLoading}
              >
                <Text style={styles.modalUnlockBtnText}>
                  {fallbackLoading ? "Verifying…" : "Unlock Ledger"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999999,
  },
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.15)",
  },
  logo: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  appName: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
    marginBottom: 44,
  },
  biometricButton: {
    marginBottom: 20,
  },
  biometricIconWrap: {
    borderRadius: 50,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(129,140,248,0.4)",
  },
  biometricGradient: {
    width: 104,
    height: 104,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  unlockLabel: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#C7D2FE",
    marginBottom: 6,
  },
  hint: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
    textAlign: "center",
    marginBottom: 36,
  },
  fallbackActionsWrap: {
    alignItems: "center",
    gap: 12,
  },
  fallbackPinBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(99,102,241,0.12)",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.3)",
  },
  fallbackPinText: {
    color: "#C7D2FE",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  logoutButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  logoutText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#F87171",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalContent: {
    backgroundColor: "#1E293B",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "#334155",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
  },
  modalSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: "#0F172A",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#F8FAFC",
    fontSize: 15,
    marginBottom: 16,
  },
  modalError: {
    color: "#F87171",
    fontSize: 13,
    marginBottom: 12,
  },
  modalUnlockBtn: {
    backgroundColor: "#6366F1",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  modalUnlockBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
