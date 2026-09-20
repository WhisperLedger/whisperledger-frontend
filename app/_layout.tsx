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
import { HouseholdProvider } from "@/context/HouseholdContext";
import { SubscriptionProvider } from "@/context/SubscriptionContext";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import BiometricGate from "@/components/BiometricGate";
import PaywallModal from "@/components/PaywallModal";
import { useColors } from "@/hooks/useColors";
import {
  DAILY_REMINDER_TYPE,
  logUserNotification,
  markSMSApprovalProcessed,
  requestNotificationPermissions,
  setupNotifications,
  SMSAction,
  SMS_APPROVAL_TYPE,
} from "@/utils/notifications";
import { markSmsIgnored, registerSMSBackgroundSync } from "@/utils/smsSync";
import { classifyCategory } from "@/utils/smsParser";
import { collection, doc, getDocs, limit, query, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import * as Device from "expo-device";

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

function smsExpenseDocId(smsId: string) {
  return `sms_${smsId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120)}`;
}

async function hasExpenseForSms(userId: string, smsId?: string | null) {
  if (!smsId) return false;
  const existing = await getDocs(
    query(collection(db, `users/${userId}/expenses`), where("smsId", "==", smsId), limit(1))
  );
  return !existing.empty;
}

async function markLinkedNotificationRead(userId: string, data: Record<string, any>) {
  if (!data.firestoreNotifId) return;
  await updateDoc(doc(db, `users/${userId}/notifications/${data.firestoreNotifId}`), { read: true }).catch(() => null);
}

function RootLayoutNav() {
  const { user, isLoading, isAuthReady } = useAuth();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
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
    requestNotificationPermissions().catch(() => null);

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
    if (user && isAuthReady) registerSMSBackgroundSync().catch((err) => {
      console.warn("[SMS Sync] Background registration skipped:", err);
    });

    if (!Notifications) return;

    const receivedSub = Notifications.addNotificationReceivedListener(async (notification: any) => {
      if (!user) return;
      const data = (notification.request.content.data || {}) as Record<string, any>;
      // Loop-Breaker: Do NOT write mock/local notifications to Firestore!
      if (data.isLocalTriggered) return;
      if (data.isLocalOnly || data.isCloudTriggered || data.notificationType === SMS_APPROVAL_TYPE) return;
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
      const isSMSApprovalAction = actionIdentifier === SMSAction.APPROVE || actionIdentifier === SMSAction.DISCARD;

      if (user) {
        if (data.isLocalTriggered || data.isCloudTriggered) {
          await markLinkedNotificationRead(user.uid, data);
        } else {
          // Only log external/push notifications that are not budget alerts or daily reminders
          if (
            !data.isLocalOnly &&
            data.notificationType !== SMS_APPROVAL_TYPE &&
            data.notificationType !== "budget_alert" &&
            data.notificationType !== "daily_reminder"
          ) {
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

      if (isSMSApprovalAction && user) {
        if (actionIdentifier === SMSAction.APPROVE) {
          try {
            if (!(await hasExpenseForSms(user.uid, String(smsId || "")))) {
              await setDoc(doc(db, `users/${user.uid}/expenses/${smsExpenseDocId(String(smsId || Date.now()))}`), {
                amount: Number(amount || 0),
                note: data.note || `Auto-synced from SMS: ${merchant}`,
                categoryId: data.categoryId || classifyCategory(String(merchant || "")),
                paymentMode: data.paymentMode || "none",
                date: data.date || new Date().toISOString().split("T")[0],
                smsId,
                merchant: merchant || "Unknown Merchant",
                createdAt: Date.now(),
              });
            }
            await markSMSApprovalProcessed(String(smsId || ""));
            console.log("Expense approved and added to Firestore");
          } catch (e) {
            console.error("Failed to add approved expense:", e);
          }
        } else {
          await markSmsIgnored(String(smsId || ""));
        }
      }

      const targetLink =
        data.notificationType === DAILY_REMINDER_TYPE || data.openAdd
          ? `/?openAdd=1&date=${data.date || new Date().toISOString().split("T")[0]}`
          : deepLink;

      if (typeof targetLink === "string" && targetLink.length > 0) {
        if (isLoading || !user) {
          // App not ready yet – stash the link and navigate once auth resolves
          pendingDeepLink.current = targetLink;
        } else {
          try {
            router.push(targetLink as any);
          } catch {
            // If the target screen does not exist, navigate to home screen
            router.push("/" as any);
          }
        }
      } else {
        // No deep link – at least ensure we're on the home tab
        if (!isLoading && user) {
          router.push("/" as any);
        }
      }
    });

    return () => {
      if (receivedSub) receivedSub.remove();
      if (responseSub) responseSub.remove();
    };
  }, [user, isAuthReady]);

  const { isDark } = useTheme();

  return (
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
  );
}


const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

function AnimatedSplashScreen({ onFinish, fontsLoaded }: { onFinish: () => void; fontsLoaded: boolean }) {
  const { isLoading } = useAuth();
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  const logoScale = useRef(new Animated.Value(0.88)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const auraPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 40,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(auraPulse, {
          toValue: 1.15,
          duration: 1100,
          useNativeDriver: true,
        }),
        Animated.timing(auraPulse, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, 600);

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
          toValue: 0.94,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(screenOpacity, {
          toValue: 0,
          duration: 200,
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
            toValue: 0.94,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(screenOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          onFinish();
        });
      }
    }, 1300);

    return () => clearTimeout(timer);
  }, [isFadingOut]);

  return (
    <Animated.View style={[splashStyles.splashContainer, { opacity: screenOpacity }]}>
      <LinearGradient
        colors={["#080A10", "#0D111E", "#080A10"]}
        style={splashStyles.splashBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Creative Ambient Glowing Aura */}
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
              source={require("../assets/images/icon.png")}
              style={splashStyles.splashLogoImage}
            />
          </Animated.View>

          {/* Clean Brand Title */}
          <Animated.Text style={[splashStyles.brandTitle, { opacity: logoOpacity }]}>
            WhisperLedger
          </Animated.Text>
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
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(56, 130, 255, 0.16)",
  },
  splashCenterWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  splashLogoWrap: {
    width: 92,
    height: 92,
    borderRadius: 24,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(56, 130, 255, 0.4)",
    marginBottom: 18,
    shadowColor: "#3882FF",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 10,
  },
  splashLogoImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  brandTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
    letterSpacing: -0.5,
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
              <SubscriptionProvider>
                <ExpenseProvider>
                  <ReceivablesProvider>
                    <HouseholdProvider>
                      <BudgetProvider>
                        <GestureHandlerRootView style={{ flex: 1 }}>
                          {resolvedLoaded ? (
                            <>
                              <BiometricGate>
                                <RootLayoutNav />
                              </BiometricGate>
                              <PaywallModal />
                            </>
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
                    </HouseholdProvider>
                  </ReceivablesProvider>
                </ExpenseProvider>
              </SubscriptionProvider>
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
