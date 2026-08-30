import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { safeHaptics } from "@/utils/haptics";
import { validatePassword } from "@/utils/passwordValidator";
import { validateEmail } from "@/utils/validation";

function translateAuthError(rawError: string | object): string {
  if (!rawError) return "An unexpected error occurred. Please try again.";
  
  const errorString = typeof rawError === "object" ? JSON.stringify(rawError) : String(rawError);
  const msg = errorString.toLowerCase();
  
  if (msg.includes("developer_error") || msg.includes("developer-error")) {
    return "Google Sign-In configuration is pending. Please verify that your local SHA-1 fingerprint is whitelisted in your Firebase Console settings.";
  }
  if (msg.includes("invalid-credential") || msg.includes("wrong-password") || msg.includes("user-not-found") || msg.includes("auth/invalid-credential")) {
    return "Incorrect email or password. Please double check and try again.";
  }
  if (msg.includes("invalid-email")) {
    return "Please enter a valid email address.";
  }
  if (msg.includes("user-disabled")) {
    return "This account has been disabled. Please contact support.";
  }
  if (msg.includes("email-already-in-use")) {
    return "This email address is already registered. Please sign in instead.";
  }
  if (msg.includes("weak-password")) {
    return "Password is too weak. Must be at least 8 characters with uppercase, lowercase, number, and special character.";
  }
  if (msg.includes("network-request-failed") || msg.includes("network_error")) {
    return "Connection error. Please check your internet connection and try again.";
  }
  if (msg.includes("too-many-requests")) {
    return "Too many failed attempts. Please try again in a few minutes.";
  }
  if (msg.includes("cancelled") || msg.includes("cancel")) {
    return "Registration was cancelled.";
  }
  
  return "Unable to create account. Please verify your details and try again.";
}

export default function RegisterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { register } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [verificationSent, setVerificationSent] = useState(false);

  const pwdValidation = validatePassword(password);
  const emailCheck = validateEmail(email.trim());
  const isEmailValid = email.trim().length > 0 && emailCheck.isValid;

  const handleRegister = async () => {
    setError("");
    if (!name.trim() || !email.trim() || !username.trim() || !password) {
      setError("Please fill in all fields.");
      return;
    }

    if (!isEmailValid) {
      setError(emailCheck.error || "Please enter a valid email address.");
      return;
    }

    if (!agreeTerms) {
      setError("Please read and tick the Privacy Consent checkbox below to proceed.");
      return;
    }

    if (!pwdValidation.isValid) {
      setError(`Password requirements not met: ${pwdValidation.errors[0]}`);
      return;
    }

    setLoading(true);
    const result = await register(username.trim(), password, name.trim(), email.trim());
    setLoading(false);
    if (result.success) {
      router.replace({
        pathname: "/login",
        params: {
          email: email.trim().toLowerCase(),
          verificationSent: "true",
        },
      });
    } else {
      setError(translateAuthError(result.error || "Registration failed"));
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1 },
    gradient: { flex: 1 },
    scroll: { flexGrow: 1, justifyContent: "center" },
    inner: {
      paddingHorizontal: 28,
      paddingTop: insets.top + 20,
      paddingBottom: insets.bottom + 40,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.text === "#f8fafc" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 24,
    },
    heading: {
      fontSize: 30,
      fontWeight: "700" as const,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      marginBottom: 6,
    },
    subheading: {
      fontSize: 14,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      marginBottom: 32,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 24,
      padding: 24,
      borderWidth: colors.text === "#f8fafc" ? 1 : 0,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 8,
    },
    label: {
      fontSize: 12,
      fontWeight: "600" as const,
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
      letterSpacing: 0.6,
      marginBottom: 8,
      marginTop: 16,
    },
    inputWrap: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.text === "#f8fafc" ? "rgba(99, 102, 241, 0.04)" : colors.muted,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.border,
      paddingHorizontal: 14,
    },
    input: {
      flex: 1,
      paddingVertical: 14,
      fontSize: 15,
      color: colors.foreground,
      fontFamily: "Inter_400Regular",
    },
    pwdHintsWrap: {
      marginTop: 10,
      backgroundColor: colors.text === "#f8fafc" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
      borderRadius: 10,
      padding: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pwdHintRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 4,
    },
    pwdHintText: {
      fontSize: 12,
      marginLeft: 6,
      fontFamily: "Inter_400Regular",
    },
    errorBox: {
      backgroundColor: colors.text === "#f8fafc" ? "rgba(239, 68, 68, 0.15)" : "#fee2e2",
      borderRadius: 10,
      padding: 12,
      marginTop: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    errorText: {
      color: colors.text === "#f8fafc" ? "#f87171" : "#dc2626",
      fontSize: 13,
      fontFamily: "Inter_500Medium",
      flex: 1,
    },
    registerBtn: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: "center",
      marginTop: 24,
    },
    registerBtnText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "700" as const,
      fontFamily: "Inter_700Bold",
    },
    loginRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 4,
      marginTop: 20,
    },
    loginText: {
      fontSize: 14,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
    loginLink: {
      fontSize: 14,
      color: colors.primary,
      fontFamily: "Inter_600SemiBold",
      fontWeight: "600" as const,
    },
  });

  return (
    <View style={styles.container}>
      <LinearGradient colors={colors.text === "#f8fafc" ? ["#0B0D18", "#080A10"] : ["#E5E7EB", "#F3F4F6"]} style={styles.gradient}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}>
          <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 80 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.inner}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                  <Feather name="arrow-left" size={20} color={colors.text === "#f8fafc" ? "#fff" : colors.primary} />
                </TouchableOpacity>
                <Image
                  source={require("../assets/images/icon.png")}
                  style={{ width: 40, height: 40, borderRadius: 12 }}
                />
              </View>
              <Text style={styles.heading}>Create account</Text>
              <Text style={styles.subheading}>Start tracking your expenses today</Text>

              {verificationSent ? (
                <View style={[styles.card, { alignItems: "center", paddingVertical: 32 }]}>
                  <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(16, 185, 129, 0.15)", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                    <Feather name="mail" size={32} color="#10B981" />
                  </View>
                  <Text style={[styles.heading, { fontSize: 20, textAlign: "center", marginBottom: 8 }]}>Verification Email Sent! 📩</Text>
                  <Text style={[styles.subheading, { textAlign: "center", marginBottom: 24, paddingHorizontal: 12 }]}>
                    We have sent a verification link to <Text style={{ color: "#6366f1", fontWeight: "700" }}>{email}</Text>. Please open your email inbox and click the verification link to activate your account.
                  </Text>
                  <TouchableOpacity
                    style={[styles.registerBtn, { width: "100%" }]}
                    onPress={() => router.replace("/login")}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.registerBtnText}>Proceed to Sign In</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.card}>
                <Text style={[styles.label, { marginTop: 0 }]}>FULL NAME</Text>
                <View style={styles.inputWrap}>
                  <Feather name="user" size={16} color={colors.mutedForeground} style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="Your full name"
                    placeholderTextColor={colors.mutedForeground}
                    returnKeyType="next"
                  />
                </View>

                <Text style={styles.label}>EMAIL</Text>
                <View style={styles.inputWrap}>
                  <Feather name="mail" size={16} color={colors.mutedForeground} style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="your@email.com"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    returnKeyType="next"
                  />
                </View>

                <Text style={styles.label}>USERNAME</Text>
                <View style={styles.inputWrap}>
                  <Feather name="at-sign" size={16} color={colors.mutedForeground} style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.input}
                    value={username}
                    onChangeText={setUsername}
                    placeholder="Choose a username"
                    placeholderTextColor={colors.mutedForeground}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                  />
                </View>

                <Text style={styles.label}>PASSWORD</Text>
                <View style={styles.inputWrap}>
                  <Feather name="lock" size={16} color={colors.mutedForeground} style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="8+ chars, uppercase, lowercase, number, symbol"
                    placeholderTextColor={colors.mutedForeground}
                    secureTextEntry={!showPwd}
                    returnKeyType="done"
                    onSubmitEditing={handleRegister}
                  />
                  <TouchableOpacity
                    onPress={() => password.length > 0 && setShowPwd((p) => !p)}
                    style={{ padding: 4, opacity: password.length > 0 ? 1 : 0.3 }}
                    disabled={password.length === 0}
                  >
                    <Feather name={showPwd ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>

                {password.length > 0 && (
                  <View style={styles.pwdHintsWrap}>
                    {[
                      { label: "8+ characters", ok: password.length >= 8 },
                      { label: "Uppercase letter (A-Z)", ok: /[A-Z]/.test(password) },
                      { label: "Lowercase letter (a-z)", ok: /[a-z]/.test(password) },
                      { label: "Number (0-9)", ok: /[0-9]/.test(password) },
                      { label: "Special symbol (@, #, $, !)", ok: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) },
                    ].map((item, idx) => (
                      <View key={idx} style={styles.pwdHintRow}>
                        <Feather
                          name={item.ok ? "check-circle" : "x-circle"}
                          size={12}
                          color={item.ok ? "#10b981" : "#ef4444"}
                        />
                        <Text style={[styles.pwdHintText, { color: item.ok ? "#10b981" : colors.mutedForeground }]}>
                          {item.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                <TouchableOpacity
                  activeOpacity={0.8}
                  style={{ flexDirection: "row", alignItems: "center", marginTop: 16, marginBottom: 8, gap: 10 }}
                  onPress={() => {
                    safeHaptics.selectionAsync();
                    setAgreeTerms(!agreeTerms);
                  }}
                >
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 5,
                      borderWidth: 2,
                      borderColor: agreeTerms ? "#6366f1" : colors.border,
                      backgroundColor: agreeTerms ? "#6366f1" : "transparent",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {agreeTerms && <Feather name="check" size={12} color="#fff" />}
                  </View>
                  <Text style={{ flex: 1, fontSize: 12, color: colors.foreground, fontFamily: "Inter_500Medium", lineHeight: 16 }}>
                    I agree to the Privacy Policy & 100% on-device local financial data parsing.
                  </Text>
                </TouchableOpacity>

                {!!error && (
                  <View style={styles.errorBox}>
                    <Feather name="alert-circle" size={14} color="#dc2626" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[
                    styles.registerBtn,
                    {
                      opacity:
                        loading ||
                        !name.trim() ||
                        !isEmailValid ||
                        !username.trim() ||
                        !pwdValidation.isValid ||
                        !agreeTerms
                          ? 0.4
                          : 1,
                    },
                  ]}
                  onPress={handleRegister}
                  disabled={
                    loading ||
                    !name.trim() ||
                    !isEmailValid ||
                    !username.trim() ||
                    !pwdValidation.isValid ||
                    !agreeTerms
                  }
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.registerBtnText}>Create Account</Text>
                  )}
                </TouchableOpacity>

                <View style={styles.loginRow}>
                  <Text style={styles.loginText}>Already have an account?</Text>
                  <TouchableOpacity onPress={() => router.back()}>
                    <Text style={styles.loginLink}>Sign in</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </View>
  );
}
