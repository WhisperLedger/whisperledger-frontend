import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { Feather } from "@expo/vector-icons";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router, Stack, useSegments, useRootNavigationState } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import Constants from "expo-constants";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View, LogBox, Image, Animated, Dimensions, StyleSheet, Text, Easing } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Sentry from "@sentry/react-native";

import { StatusBar } from "expo-status-bar";

LogBox.ignoreLogs([
  "You are initializing Firebase Auth for React Native without providing AsyncStorage",
  "Push token registration skipped",
  "Default FirebaseApp is not initialized in this process",
]);
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ExpenseProvider } from "@/context/ExpenseContext";
import { ReceivablesProvider } from "@/context/ReceivablesContext";
import { BudgetProvider } from "@/context/BudgetContext";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { useColors } from "@/hooks/useColors";
import { logUserNotification, setupNotifications, SMSAction } from "@/utils/notifications";
import { classifyCategory } from "@/utils/smsParser";
import { collection, addDoc, doc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import * as Device from "expo-device";
import { BiometricGate } from "@/components/BiometricGate";

// Initialize Sentry for crash reporting and performance monitoring
Sentry.init({
  dsn: "https://your-sentry-dsn@o0.ingest.sentry.io/0", // REPLACE with your actual DSN from sentry.io
  debug: false,
  tracesSampleRate: 0.2, // 20% of transactions for performance profiling
  environment: __DEV__ ? "development" : "production",
});


function isPermissionDeniedError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const maybe = error as { code?: string; message?: string };
  return (
    maybe.code === "permission-denied" ||
    (typeof maybe.message === "string" && maybe.message.toLowerCase().includes("insufficient permissions"))
  );
}

SplashScreen.preventAutoHideAsync();
function getNotificationsModule() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("expo-notifications");
  } catch {
    return null;
  }
}

const Notifications = getNotificationsModule();
if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { user, isLoading, isAuthReady } = useAuth();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const processedNotifIds = useRef(new Set<string>()).current;
  // Store a deep link that arrived before the router/auth was ready
  const pendingDeepLink = useRef<string | null>(null);

  useEffect(() => {
    if (isLoading || !navigationState?.key) return;

    const inAuthGroup = segments[0] === "login" || segments[0] === "register";

    if (!user) {
      if (!inAuthGroup) {
        console.warn("👉 [RootLayoutNav] Redirecting to /login");
        setTimeout(() => {
          try {
            router.replace("/login");
          } catch (e) {
            console.warn("Auth redirect failed:", e);
          }
        }, 10);
      }
    } else {
      if (pendingDeepLink.current) {
        const link = pendingDeepLink.current;
        pendingDeepLink.current = null;
        console.warn("👉 [RootLayoutNav] Redirecting to pending deep link:", link);
        setTimeout(() => {
          try {
            router.push(link as any);
          } catch {
            router.push("/(tabs)" as any);
          }
        }, 300);
      } else if (inAuthGroup || !segments[0]) {
        console.warn("👉 [RootLayoutNav] Redirecting to /(tabs)");
        setTimeout(() => {
          try {
            router.replace("/(tabs)");
          } catch (e) {
            console.warn("Auth redirect failed:", e);
          }
        }, 10);
      }
    }
  }, [user, isLoading, isAuthReady, segments, navigationState?.key]);


  useEffect(() => {
    setupNotifications();

    // Check for cold-launch notification deep links immediately on startup
    if (Notifications) {
      Notifications.getLastNotificationResponseAsync().then((response: any) => {
        if (response) {
          const data = (response.notification.request.content.data || {}) as Record<string, any>;
          const { deepLink } = data;
          if (typeof deepLink === "string" && deepLink.length > 0) {
            if (isLoading || !user) {
              pendingDeepLink.current = deepLink;
            } else {
              setTimeout(() => {
                try {
                  router.push(deepLink as any);
                } catch {
                  router.push("/(tabs)" as any);
                }
              }, 600);
            }
          }
        }
      }).catch(() => null);
    }

    const registerPushToken = async () => {
      if (!Notifications) {
        console.warn("[Push] Notifications module is missing");
        return;
      }

      // Emulator / simulator — register a mock token so admin dashboard shows the user
      if (!Device.isDevice) {
        if (user) {
          try {
            await setDoc(doc(db, `users/${user.uid}`), {
              uid: user.uid,
              name: user.name,
              email: user.email,
              pushToken: `mock_emulator_token_${user.uid.slice(0, 5)}`,
              lastActive: Date.now(),
            }, { merge: true });
          } catch (err) {
            console.warn("[Push] Failed to register emulator mock token:", err);
          }
        }
        return;
      }

      // Request permission first
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== "granted") {
          console.warn("[Push] Notification permission not granted");
          return;
        }
      } catch (permErr: any) {
        console.warn("[Push] Permission check failed:", permErr?.message);
        return;
      }

      // Get Expo push token — this is what the admin dashboard and Expo Push API need.
      // getExpoPushTokenAsync works on real devices once Firebase is initialized natively.
      try {
        const projectId =
          Constants?.expoConfig?.extra?.eas?.projectId ||
          Constants?.easConfig?.projectId;
        const token = (
          await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)
        ).data;

        if (user && token) {
          await setDoc(doc(db, `users/${user.uid}`), {
            uid: user.uid,
            name: user.name,
            email: user.email,
            pushToken: token,
            lastActive: Date.now(),
          }, { merge: true });
          console.log("[Push] Expo push token registered ✅", token.slice(0, 40));
        }
      } catch (err: any) {
        // Log quietly — no red box in dev mode
        console.warn("[Push] Token registration failed (will retry on next launch):", err?.message);
      }
    };

    if (user && isAuthReady) registerPushToken();


    let unsubNotifications: (() => void) | null = null;

    if (user && isAuthReady) {
      const {
        collection: fsCollection,
        query: fsQuery,
        orderBy: fsOrderBy,
        limit: fsLimit,
        onSnapshot: fsOnSnapshot,
      } = require("firebase/firestore");

      const q = fsQuery(
        fsCollection(db, `users/${user.uid}/notifications`),
        fsOrderBy("createdAt", "desc"),
        fsLimit(20)
      );

      unsubNotifications = fsOnSnapshot(q, (snapshot: any) => {
        snapshot.docChanges().forEach(async (change: any) => {
          if ((change.type === "added" || change.type === "modified") && Notifications) {
            const data = change.doc.data();
            const docId = change.doc.id;

            if (!data.read && !processedNotifIds.has(docId)) {
              processedNotifIds.add(docId);
              try {
                await Notifications.scheduleNotificationAsync({
                  content: {
                    title: data.title || "Notification",
                    body: data.body || "",
                    data: {
                      ...(data.data || {}),
                      imageUrl: data.imageUrl,
                      image: data.imageUrl,
                      picture: data.imageUrl,
                      bigPictureUrl: data.imageUrl,
                      isLocalTriggered: true,
                      firestoreNotifId: docId,
                    },
                    ...(data.imageUrl ? { attachments: [{ url: data.imageUrl, identifier: "image" }] } : {}),
                    sound: true,
                    priority: "max",
                    channelId: "default",
                  },
                  trigger: null,
                });
                console.log("[Notifications] Heads-up push notification banner presented for:", docId);
              } catch (e) {
                console.warn("[Notifications] Failed to schedule local notification:", e);
              }
            } else {
              processedNotifIds.add(docId);
            }
          }
        });
      }, (err: any) => {
        console.warn("[Notifications] Real-time listener failed:", err);
      });
    }

    const receivedSub = Notifications.addNotificationReceivedListener(async (notification: any) => {
      if (!user) return;
      const data = (notification.request.content.data || {}) as Record<string, any>;
      // Loop-Breaker: Do NOT write mock/local notifications to Firestore!
      if (data.isLocalTriggered) return;
      // Do not write budget alerts or daily reminders to Firestore logs
      if (data.notificationType === "budget_alert" || data.notificationType === "daily_reminder") return;

      try {
        await logUserNotification({
          userId: user.uid,
          notificationId: notification.request.identifier,
          title: notification.request.content.title || "Notification",
          body: notification.request.content.body || "",
          notificationType: (data.notificationType as string) || "general",
          data,
        });
      } catch (e) {
        if (isPermissionDeniedError(e)) {
          console.warn("Notification receive log skipped due to Firestore permissions.");
          return;
        }
        console.warn("Notification receive log failed:", e);
      }
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener(async (response: any) => {
      const { actionIdentifier, notification } = response;
      const data = (notification.request.content.data || {}) as Record<string, any>;
      const { smsId, amount, merchant, deepLink } = data;

      if (user) {
        if (data.isLocalTriggered) {
          // If local notification is tapped, update its Firestore read status directly!
          if (data.firestoreNotifId) {
            const { doc: fsDoc, updateDoc: fsUpdateDoc } = require("firebase/firestore");
            await fsUpdateDoc(fsDoc(db, `users/${user.uid}/notifications/${data.firestoreNotifId}`), { read: true }).catch(() => null);
          }
        } else {
          // Only log external/push notifications that are not budget alerts or daily reminders
          if (data.notificationType !== "budget_alert" && data.notificationType !== "daily_reminder") {
            try {
              await logUserNotification({
                userId: user.uid,
                notificationId: notification.request.identifier,
                title: notification.request.content.title || "Notification",
                body: notification.request.content.body || "",
                notificationType: (data.notificationType as string) || "general",
                data,
                read: true,
              });
            } catch (e) {
              if (isPermissionDeniedError(e)) {
                console.warn("Notification response log skipped due to Firestore permissions.");
              } else {
                console.warn("Notification response log failed:", e);
              }
            }
          }
        }
      }

      if (typeof deepLink === "string" && deepLink.length > 0) {
        if (isLoading || !user) {
          // App not ready yet – stash the link and navigate once auth resolves
          pendingDeepLink.current = deepLink;
        } else {
          try {
            router.push(deepLink as any);
          } catch {
            // If the target screen does not exist, navigate to home screen
            router.push("/(tabs)" as any);
          }
        }
      } else {
        // No deep link – at least ensure we're on the home tab
        if (!isLoading && user) {
          router.push("/(tabs)" as any);
        }
      }

      if (actionIdentifier === SMSAction.APPROVE && user) {
        try {
          await addDoc(collection(db, `users/${user.uid}/expenses`), {
            amount,
            note: data.note || `Auto-synced from SMS: ${merchant}`,
            categoryId: data.categoryId || classifyCategory(String(merchant || "")),
            paymentMode: data.paymentMode || "none",
            date: data.date || new Date().toISOString().split("T")[0],
            smsId,
            createdAt: Date.now(),
          });
          console.log("Expense approved and added to Firestore");
        } catch (e) {
          console.error("Failed to add approved expense:", e);
        }
      }
    });

    return () => {
      if (receivedSub) receivedSub.remove();
      if (responseSub) responseSub.remove();
      if (unsubNotifications) unsubNotifications();
    };
  }, [user, isAuthReady]);

  const { isDark } = useTheme();

  return (
    <BiometricGate>
      <>
        <StatusBar style={isDark ? "light" : "dark"} />
        {isLoading ? (
          <View style={{ flex: 1, backgroundColor: isDark ? "#050814" : "#F3F4F6" }} />
        ) : (
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="login" options={{ headerShown: false, animation: "fade" }} />
            <Stack.Screen name="register" options={{ headerShown: false, animation: "slide_from_right" }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="recovery" options={{ headerShown: false, animation: "slide_from_right" }} />
            <Stack.Screen name="notifications" options={{ headerShown: false, presentation: "card" }} />
            <Stack.Screen name="about" options={{ presentation: "modal", headerShown: false }} />
            <Stack.Screen name="faq" options={{ presentation: "modal", headerShown: false }} />
          </Stack>
        )}
      </>
    </BiometricGate>
  );
}


const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

function AnimatedSplashScreen({ onFinish, fontsLoaded }: { onFinish: () => void; fontsLoaded: boolean }) {
  const { isLoading } = useAuth();
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  // High-end zero-flicker seamless transition parameters
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const auraPulse = useRef(new Animated.Value(1)).current;
  const progressWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance animations
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(progressWidth, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();

    // Pulse aura animation
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(auraPulse, {
          toValue: 1.12,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(auraPulse, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, 700);

    return () => {
      clearTimeout(timer);
      pulse.stop();
    };
  }, []);

  useEffect(() => {
    if (!isLoading && fontsLoaded && minTimeElapsed && !isFadingOut) {
      setIsFadingOut(true);
      Animated.parallel([
        Animated.timing(logoScale, {
          toValue: 0.95,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(screenOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onFinish();
      });
    }
  }, [isLoading, fontsLoaded, minTimeElapsed, isFadingOut]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isFadingOut) {
        setIsFadingOut(true);
        Animated.parallel([
          Animated.timing(logoScale, {
            toValue: 0.95,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(screenOpacity, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }),
        ]).start(() => {
          onFinish();
        });
      }
    }, 1600);

    return () => clearTimeout(timer);
  }, [isFadingOut]);

  const animatedProgressWidth = progressWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <Animated.View style={[splashStyles.splashContainer, { opacity: screenOpacity }]}>
      <LinearGradient
        colors={["#0B0D18", "#1E1B4B", "#050711"]}
        style={splashStyles.splashBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Ambient Glowing Aura */}
        <Animated.View
          style={[
            splashStyles.auraGlow,
            { transform: [{ scale: auraPulse }] },
          ]}
        />

        <View style={splashStyles.splashCenterWrap}>
          {/* Logo Card */}
          <Animated.View
            style={[
              splashStyles.splashLogoWrap,
              {
                opacity: logoOpacity,
                transform: [{ scale: logoScale }],
              },
            ]}
          >
            <Image
              source={require("../assets/images/splash.png")}
              style={splashStyles.splashLogoImage}
            />
          </Animated.View>

          {/* Typography */}
          <Animated.Text style={[splashStyles.brandTitle, { opacity: logoOpacity }]}>
            WhisperLedger
          </Animated.Text>

          <Animated.Text style={[splashStyles.brandTagline, { opacity: logoOpacity }]}>
            POST-PURCHASE MONEY RECOVERY AGENT
          </Animated.Text>

          {/* Feature Badge Chips */}
          <Animated.View style={[splashStyles.featureChipsRow, { opacity: logoOpacity }]}>
            <View style={splashStyles.featureChip}>
              <Text style={splashStyles.featureChipText}>💰 Money Recovery</Text>
            </View>
            <View style={splashStyles.featureChip}>
              <Text style={splashStyles.featureChipText}>🔒 Zero-Knowledge</Text>
            </View>
            <View style={splashStyles.featureChip}>
              <Text style={splashStyles.featureChipText}>⚡ SMS Auto-Sync</Text>
            </View>
          </Animated.View>

          {/* Glowing Shimmer Progress Bar */}
          <View style={splashStyles.progressContainer}>
            <View style={splashStyles.progressTrack}>
              <Animated.View
                style={[
                  splashStyles.progressFill,
                  { width: animatedProgressWidth },
                ]}
              >
                <LinearGradient
                  colors={["#6366f1", "#10b981"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            </View>
          </View>

          <View style={splashStyles.privacyPill}>
            <Text style={splashStyles.privacyDot}>●</Text>
            <Text style={splashStyles.privacyText}>100% PRIVATE & OFFLINE</Text>
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const splashStyles = StyleSheet.create({
  splashContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
  },
  splashBackground: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  auraGlow: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(99, 102, 241, 0.18)",
  },
  splashCenterWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  splashLogoWrap: {
    width: 104,
    height: 104,
    borderRadius: 26,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(99, 102, 241, 0.4)",
    marginBottom: 20,
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  splashLogoImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  brandTitle: {
    fontSize: 34,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  brandTagline: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#818CF8",
    letterSpacing: 1.2,
    marginBottom: 20,
  },
  featureChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginBottom: 32,
  },
  featureChip: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  featureChipText: {
    color: "#CBD5E1",
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  progressContainer: {
    width: 160,
    height: 4,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  progressTrack: {
    width: "100%",
    height: 3,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  privacyPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
  },
  privacyDot: {
    color: "#10B981",
    fontSize: 10,
    marginRight: 6,
  },
  privacyText: {
    color: "#34D399",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.6,
  },
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    ...Feather.font,
  });

  const [splashFinished, setSplashFinished] = useState(false);
  const [forceLoaded, setForceLoaded] = useState(false);

  useEffect(() => {
    // Safety timer: force load resolution after 1.5 seconds if fonts fail to report status
    const timer = setTimeout(() => {
      setForceLoaded(true);
      SplashScreen.hideAsync().catch(() => null);
    }, 1500);

    if (fontsLoaded || fontError) {
      clearTimeout(timer);
      SplashScreen.hideAsync().catch(() => null);
    }

    return () => {
      clearTimeout(timer);
    };
  }, [fontsLoaded, fontError]);

  const resolvedLoaded = !!(fontsLoaded || fontError || forceLoaded);

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <ExpenseProvider>
                <ReceivablesProvider>
                  <BudgetProvider>
                    <GestureHandlerRootView style={{ flex: 1 }}>
                      {resolvedLoaded ? (
                        <RootLayoutNav />
                      ) : (
                        <View style={{ flex: 1, backgroundColor: "#FFFFFF" }} />
                      )}
                      {!splashFinished && (
                        <AnimatedSplashScreen 
                          onFinish={() => setSplashFinished(true)} 
                          fontsLoaded={resolvedLoaded}
                        />
                      )}
                    </GestureHandlerRootView>
                  </BudgetProvider>
                </ReceivablesProvider>
              </ExpenseProvider>
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
