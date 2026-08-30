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
import { safeHaptics } from "@/utils/haptics";
import * as Haptics from "expo-haptics";

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
  const pulseAnim1 = useRef(new Animated.Value(1)).current;
  const pulseAnim2 = useRef(new Animated.Value(1)).current;
  const appState = useRef(AppState.currentState);
  const lastUnlockedAt = useRef<number>(0);
  const RELOCK_GRACE_MS = 30_000;

  useEffect(() => {
    const pulse1 = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim1, {
          toValue: 1.18,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim1, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: true,
        }),
      ])
    );
    const pulse2 = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim2, {
          toValue: 1.32,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim2, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse1.start();
    pulse2.start();
    return () => {
      pulse1.stop();
      pulse2.stop();
    };
  }, []);

  useEffect(() => {
    let active = true;

    const timer = setTimeout(() => {
      if (active && checkingHardware) {
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
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = await authenticateWithBiometrics(
      "Touch the fingerprint sensor to unlock WhisperLedger"
    );
    setIsAuthenticating(false);

    if (result.success) {
      safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
    } else {
      safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
      setFallbackPassword("");
    } else {
      setFallbackError(res.error || "Incorrect password. Please try again.");
    }
  };

  if (isUnlocked || !user) {
    return <>{children}</>;
  }

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
          colors={["#050811", "#0B132B", "#080B15"]}
          style={styles.gradient}
        >
          {/* Subtle Ambient Radial Glow */}
          <View style={styles.ambientAura} />

          <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
            {/* Header Badge */}
            <View style={styles.securityPill}>
              <Feather name="lock" size={12} color="#60A5FA" />
              <Text style={styles.securityPillText}>256-BIT ENCRYPTED VAULT</Text>
            </View>

            {/* App Branding */}
            <View style={styles.brandWrap}>
              <View style={styles.logoWrap}>
                <Image
                  source={require("../assets/images/icon.png")}
                  style={styles.logo}
                />
              </View>
              <Text style={styles.appName}>WhisperLedger</Text>
              <Text style={styles.subtitle}>Private On-Device Financial Intelligence</Text>
            </View>

            {/* Central High-Tech Biometric Scanner Hub */}
            <View style={styles.scannerCenter}>
              {/* Outer Pulse Wave Ring */}
              <Animated.View
                style={[
                  styles.outerPulseRing,
                  { transform: [{ scale: pulseAnim2 }] },
                ]}
              />

              {/* Inner Pulse Glow Ring */}
              <Animated.View
                style={[
                  styles.innerPulseRing,
                  { transform: [{ scale: pulseAnim1 }] },
                ]}
              />

              {/* Central Touch Target Button */}
              <TouchableOpacity
                onPress={handleUnlockPress}
                activeOpacity={0.8}
                disabled={isAuthenticating}
                style={styles.scannerButton}
              >
                <LinearGradient
                  colors={["#0066FF", "#1D4ED8"]}
                  style={styles.scannerGrad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Feather
                    name={biometricType === "faceId" ? "smile" : "shield"}
                    size={42}
                    color="#FFFFFF"
                  />
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Scanner Status Label */}
            <View style={styles.statusWrap}>
              <Text style={styles.unlockLabel}>
                {isAuthenticating
                  ? "Verifying Secure Credentials…"
                  : biometricType === "faceId"
                  ? "Face ID Ready"
                  : "Touch Fingerprint Sensor"}
              </Text>
              <Text style={styles.hint}>
                Tap the shield to trigger hardware biometric scan
              </Text>
            </View>

            {/* Explicit Fallback & Account Actions */}
            <View style={styles.fallbackActionsWrap}>
              <TouchableOpacity
                onPress={() => {
                  safeHaptics.selectionAsync();
                  setShowPasswordFallback(true);
                }}
                style={styles.fallbackPinBtn}
                activeOpacity={0.8}
              >
                <Feather name="key" size={15} color="#60A5FA" style={{ marginRight: 8 }} />
                <Text style={styles.fallbackPinText}>Enter Password</Text>
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
                <Text style={styles.logoutText}>Sign Out of Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>

        {/* Password Fallback Modal */}
        <Modal
          visible={showPasswordFallback}
          animationType="fade"
          transparent
          onRequestClose={() => setShowPasswordFallback(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Unlock Ledger</Text>
                <TouchableOpacity onPress={() => setShowPasswordFallback(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Feather name="x" size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSub}>
                Enter password for {user?.email || user?.username}
              </Text>

              <TextInput
                style={styles.modalInput}
                placeholder="Account password"
                placeholderTextColor="#64748B"
                secureTextEntry
                value={fallbackPassword}
                onChangeText={setFallbackPassword}
                autoFocus
              />

              {!!fallbackError && (
                <Text style={styles.modalError}>{fallbackError}</Text>
              )}

              <TouchableOpacity
                style={styles.modalUnlockBtn}
                onPress={handlePasswordUnlock}
                disabled={fallbackLoading}
                activeOpacity={0.85}
              >
                <Text style={styles.modalUnlockBtnText}>
                  {fallbackLoading ? "Authenticating…" : "Unlock"}
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
  ambientAura: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(0, 102, 255, 0.12)",
    top: "30%",
    alignSelf: "center",
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 28,
  },
  securityPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(56, 130, 255, 0.12)",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(56, 130, 255, 0.25)",
  },
  securityPillText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#93C5FD",
    letterSpacing: 0.8,
  },
  brandWrap: {
    alignItems: "center",
  },
  logoWrap: {
    width: 68,
    height: 68,
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: "rgba(56, 130, 255, 0.35)",
    shadowColor: "#0066FF",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  logo: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  appName: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
    textAlign: "center",
  },
  scannerCenter: {
    width: 150,
    height: 150,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 10,
  },
  outerPulseRing: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1.5,
    borderColor: "rgba(56, 130, 255, 0.2)",
    backgroundColor: "rgba(0, 102, 255, 0.04)",
  },
  innerPulseRing: {
    position: "absolute",
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 1.5,
    borderColor: "rgba(56, 130, 255, 0.4)",
    backgroundColor: "rgba(0, 102, 255, 0.08)",
  },
  scannerButton: {
    width: 92,
    height: 92,
    borderRadius: 46,
    overflow: "hidden",
    shadowColor: "#0066FF",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 10,
  },
  scannerGrad: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  statusWrap: {
    alignItems: "center",
  },
  unlockLabel: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
    marginBottom: 4,
    textAlign: "center",
  },
  hint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
    textAlign: "center",
  },
  fallbackActionsWrap: {
    alignItems: "center",
    width: "100%",
    gap: 12,
  },
  fallbackPinBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingVertical: 13,
    paddingHorizontal: 28,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    width: "100%",
  },
  fallbackPinText: {
    color: "#F8FAFC",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  logoutButton: {
    paddingVertical: 6,
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
    backgroundColor: "#0B132B",
    borderRadius: 22,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(56, 130, 255, 0.25)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 16,
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
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: 16,
    paddingVertical: 13,
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
    backgroundColor: "#0066FF",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  modalUnlockBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
