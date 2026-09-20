import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  AppState,
  AppStateStatus,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import {
  authenticateWithBiometrics,
  checkBiometricAvailable,
  isBiometricEnabled,
} from "@/hooks/useBiometric";
import { safeHaptics } from "@/utils/haptics";

interface BiometricGateProps {
  children: React.ReactNode;
}

const RELOCK_GRACE_MS = 30000; // 30 seconds

export function BiometricGate({ children }: BiometricGateProps) {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const [isUnlocked, setIsUnlocked] = useState(true);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [biometricType, setBiometricType] = useState<"fingerprint" | "faceId" | "iris" | "none">("none");
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const lockOpacity = useRef(new Animated.Value(1)).current;
  const lockScale = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const lastBackgroundTime = useRef(0);
  const appState = useRef(AppState.currentState);

  const isAuthenticatingRef = useRef(false);
  const isUnlockedRef = useRef(true);
  const isSystemPromptActiveRef = useRef(false);
  const hasInitializedRef = useRef(false);

  // Pulse animation for biometric icon
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  const triggerAuth = useCallback(async () => {
    if (isAuthenticatingRef.current || isUnlockedRef.current) return;
    isAuthenticatingRef.current = true;
    setIsAuthenticating(true);
    isSystemPromptActiveRef.current = true;

    try {
      const result = await authenticateWithBiometrics("Unlock WhisperLedger");
      if (result.success) {
        isUnlockedRef.current = true;
        safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Animated.parallel([
          Animated.timing(lockOpacity, {
            toValue: 0,
            duration: 220,
            useNativeDriver: true,
          }),
          Animated.timing(lockScale, {
            toValue: 0.95,
            duration: 220,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setIsUnlocked(true);
          lockOpacity.setValue(1);
          lockScale.setValue(1);
        });
      } else {
        safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      isAuthenticatingRef.current = false;
      setIsAuthenticating(false);
      // Wait before resetting prompt active flag so resume AppState transition is ignored
      setTimeout(() => {
        isSystemPromptActiveRef.current = false;
      }, 600);
    }
  }, [lockOpacity, lockScale]);

  // Initial check on mount (runs once per authenticated user)
  useEffect(() => {
    let active = true;

    async function initBiometrics() {
      if (Platform.OS === "web") {
        isUnlockedRef.current = true;
        setIsUnlocked(true);
        return;
      }

      const enabled = await isBiometricEnabled();
      if (!active) return;
      setBiometricEnabledState(enabled);

      if (!enabled || !user) {
        // Disabled or logged out: unlock immediately without prompt
        isUnlockedRef.current = true;
        setIsUnlocked(true);
        return;
      }

      // Biometrics are enabled and user is logged in
      const { available, biometricType: bt } = await checkBiometricAvailable();
      if (!active) return;

      if (!available) {
        isUnlockedRef.current = true;
        setIsUnlocked(true);
        return;
      }

      setBiometricType(bt);
      isUnlockedRef.current = false;
      setIsUnlocked(false);

      // Trigger authentication once on startup
      setTimeout(() => {
        if (active && !isUnlockedRef.current) {
          triggerAuth();
        }
      }, 350);
    }

    if (!hasInitializedRef.current && user) {
      hasInitializedRef.current = true;
      void initBiometrics();
    } else if (!user) {
      isUnlockedRef.current = true;
      setIsUnlocked(true);
      hasInitializedRef.current = false;
    }

    return () => {
      active = false;
    };
  }, [user?.uid, triggerAuth]);

  // Unlock automatically if user logs out
  useEffect(() => {
    if (!user) {
      isUnlockedRef.current = true;
      setIsUnlocked(true);
    }
  }, [user]);

  // AppState listener: lock on return from background if enabled
  useEffect(() => {
    const sub = AppState.addEventListener("change", async (nextState: AppStateStatus) => {
      // If the state transition is from the system biometric bottomsheet dialog, ignore it
      if (isSystemPromptActiveRef.current) {
        appState.current = nextState;
        return;
      }

      if (appState.current === "active" && (nextState === "background" || nextState === "inactive")) {
        lastBackgroundTime.current = Date.now();
      } else if (
        (appState.current === "background" || appState.current === "inactive") &&
        nextState === "active"
      ) {
        const enabled = await isBiometricEnabled();
        setBiometricEnabledState(enabled);

        if (enabled && user && isUnlockedRef.current) {
          const elapsed = Date.now() - lastBackgroundTime.current;
          if (elapsed > RELOCK_GRACE_MS) {
            isUnlockedRef.current = false;
            setIsUnlocked(false);
            setTimeout(() => {
              if (!isUnlockedRef.current) triggerAuth();
            }, 300);
          }
        }
      }
      appState.current = nextState;
    });

    return () => sub.remove();
  }, [user?.uid, triggerAuth]);

  if (isUnlocked || !biometricEnabled || !user) {
    return <>{children}</>;
  }

  const iconName = biometricType === "faceId" ? "smile" : "disc";

  return (
    <View style={styles.fullRoot}>
      {children}
      <Animated.View
        style={[
          styles.lockOverlay,
          {
            opacity: lockOpacity,
            transform: [{ scale: lockScale }],
          },
        ]}
      >
        <LinearGradient
          colors={["#080A10", "#0D111E", "#080A10"]}
          style={styles.gradient}
        >
          <View style={[styles.lockContainer, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
            {/* Header / Logo */}
            <View style={styles.topSection}>
              <View style={styles.logoBadge}>
                <Image
                  source={require("../assets/images/icon.png")}
                  style={styles.logoImage}
                />
              </View>
              <Text style={styles.appName}>WhisperLedger</Text>
              <Text style={styles.securitySub}>App Locked</Text>
            </View>

            {/* Central Biometric Action Button */}
            <View style={styles.centerSection}>
              <TouchableOpacity
                onPress={triggerAuth}
                activeOpacity={0.75}
                disabled={isAuthenticating}
                style={styles.biometricTouch}
              >
                <Animated.View style={[styles.auraCircle, { transform: [{ scale: pulseAnim }] }]} />
                <View style={styles.iconCircle}>
                  <Feather
                    name={iconName as any}
                    size={38}
                    color="#3882FF"
                  />
                </View>
              </TouchableOpacity>

              <Text style={styles.authTitle}>
                {isAuthenticating
                  ? "Authenticating…"
                  : biometricType === "faceId"
                  ? "Unlock with Face ID"
                  : "Unlock with Fingerprint"}
              </Text>
              <Text style={styles.authDesc}>
                Tap the sensor or use your device PIN
              </Text>
            </View>

            {/* Fallback & Sign Out Options */}
            <View style={styles.bottomSection}>
              <TouchableOpacity
                onPress={triggerAuth}
                activeOpacity={0.7}
                style={styles.pinFallbackBtn}
              >
                <Feather name="key" size={14} color="#94A3B8" style={{ marginRight: 6 }} />
                <Text style={styles.pinFallbackText}>Use Device PIN / Password</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={async () => {
                  try {
                    await logout();
                    isUnlockedRef.current = true;
                    setIsUnlocked(true);
                  } catch {
                    Alert.alert("Error", "Failed to sign out");
                  }
                }}
                style={styles.signOutBtn}
                activeOpacity={0.7}
              >
                <Feather name="log-out" size={14} color="#EF4444" style={{ marginRight: 6 }} />
                <Text style={styles.signOutText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fullRoot: {
    flex: 1,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999999,
  },
  gradient: {
    flex: 1,
  },
  lockContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 32,
  },
  topSection: {
    alignItems: "center",
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(56, 130, 255, 0.3)",
    marginBottom: 14,
    shadowColor: "#3882FF",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  logoImage: {
    width: "100%",
    height: "100%",
  },
  appName: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
    letterSpacing: -0.4,
  },
  securitySub: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "rgba(148, 163, 184, 0.7)",
    marginTop: 4,
    letterSpacing: 0.5,
  },
  centerSection: {
    alignItems: "center",
  },
  biometricTouch: {
    width: 100,
    height: 100,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  auraCircle: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(56, 130, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 130, 255, 0.25)",
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderWidth: 1.5,
    borderColor: "rgba(56, 130, 255, 0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  authTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#F1F5F9",
    marginBottom: 6,
  },
  authDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
    textAlign: "center",
  },
  bottomSection: {
    width: "100%",
    alignItems: "center",
    gap: 12,
  },
  pinFallbackBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  pinFallbackText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#94A3B8",
  },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
  },
  signOutText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#EF4444",
  },
});

export default BiometricGate;
