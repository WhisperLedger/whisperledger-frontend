import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import PrivacyConsentModal from "@/components/PrivacyConsentModal";
import SupportModal from "@/components/SupportModal";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { isSmsAutoSyncAvailable, requestSmsPermission } from "@/utils/smsParser";
import { queueSMSApprovalNotifications, registerSMSBackgroundSync, unregisterSMSBackgroundSync } from "@/utils/smsSync";
import { useTheme } from "@/context/ThemeContext";
import { appGradients, iconSurface, isDarkPalette, surfaceStyle } from "@/utils/designSystem";

interface MenuItemProps {
  icon: string;
  label: string;
  sublabel?: string;
  onPress: () => void;
  danger?: boolean;
  rightText?: string;
  rightElement?: React.ReactNode;
}

function MenuItem({ icon, label, sublabel, onPress, danger, rightText, rightElement }: MenuItemProps) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: 16,
        gap: 14,
      }}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 11,
          backgroundColor: danger
            ? (colors.text === "#f8fafc" || colors.text === "#F8FAF7" ? "rgba(239, 68, 68, 0.12)" : "#fee2e2")
            : colors.muted,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: colors.text === "#f8fafc" || colors.text === "#F8FAF7" ? 1 : 0,
          borderColor: danger ? "rgba(239, 68, 68, 0.25)" : colors.border,
        }}
      >
        <Feather 
          name={icon as any} 
          size={18} 
          color={danger ? "#ef4444" : colors.primary}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 15,
            fontFamily: "Inter_500Medium",
            fontWeight: "500" as const,
            color: danger ? "#ef4444" : colors.foreground,
          }}
        >
          {label}
        </Text>
        {!!sublabel && (
          <Text style={{ fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 }}>
            {sublabel}
          </Text>
        )}
      </View>
      {rightElement ? (
        rightElement
      ) : rightText ? (
        <Text style={{ fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>
          {rightText}
        </Text>
      ) : (
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
      )}
    </TouchableOpacity>
  );
}

function Divider() {
  const colors = useColors();
  return <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 16 }} />;
}

const getFallbackAvatar = (isDarkTheme: boolean) =>
  isDarkTheme
    ? require("../../assets/images/default_avatar_dark.png")
    : require("../../assets/images/default_avatar_light.png");

export default function ProfileScreen() {
  const colors = useColors();
  const { theme, setTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, logout, updateProfile } = useAuth();
  const isDark = isDarkPalette(colors);
  const gradients = appGradients(colors);

  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(user?.name || "");
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showAvatarOptions, setShowAvatarOptions] = useState(false);
  const [pendingAvatar, setPendingAvatar] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [showAvatarPreview, setShowAvatarPreview] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);

  React.useEffect(() => {
    setAvatarLoadFailed(false);
  }, [user?.avatarUri]);

  React.useEffect(() => {
    if (!editingName) {
      setNameVal(user?.name || "");
    }
  }, [user?.name, editingName]);

  React.useEffect(() => {
    AsyncStorage.getItem("@auto_sync_enabled").then(val => {
      setAutoSyncEnabled(val === "true");
    });
  }, []);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const MAX_PROFILE_PHOTO_MB = 5;
  const MAX_PROFILE_PHOTO_BYTES = MAX_PROFILE_PHOTO_MB * 1024 * 1024;

  const pickAvatar = async () => {
    setShowAvatarOptions(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow access to your photos to set a profile picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      const pickedImage = result.assets[0];
      if (pickedImage.fileSize && pickedImage.fileSize > MAX_PROFILE_PHOTO_BYTES) {
        Alert.alert(
          "Image too large",
          `Please choose a photo under ${MAX_PROFILE_PHOTO_MB} MB for faster loading. Recommended: square image, at least 512 x 512 pixels.`
        );
        return;
      }
      setPendingAvatar(pickedImage);
      setShowAvatarPreview(true);
    }
  };

  const savePendingAvatar = async () => {
    if (!pendingAvatar || savingAvatar) return;
    setSavingAvatar(true);
    try {
      await updateProfile({ avatarUri: pendingAvatar.uri });
      setAvatarLoadFailed(false);
      setShowAvatarPreview(false);
      setPendingAvatar(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setSavingAvatar(false);
    }
  };

  const removeAvatar = async () => {
    setShowAvatarOptions(false);
    await updateProfile({ avatarUri: "" });
    setAvatarLoadFailed(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleAvatarPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowAvatarOptions(true);
  };

  const handleLogout = async () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await logout();
          router.replace("/login");
        },
      },
    ]);
  };

  const saveName = async () => {
    await updateProfile({ name: nameVal.trim() || user?.name || "" });
    setEditingName(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const [showConsentModal, setShowConsentModal] = useState(false);

  const handleToggleAutoSync = async (newValue: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!newValue) {
      setAutoSyncEnabled(false);
      await AsyncStorage.setItem("@auto_sync_enabled", "false");
      await unregisterSMSBackgroundSync();
      return;
    }
    setShowConsentModal(true);
  };

  const proceedWithSmsSync = async () => {
    try {
      if (Platform.OS !== "android" || !isSmsAutoSyncAvailable()) {
        setAutoSyncEnabled(false);
        await AsyncStorage.setItem("@auto_sync_enabled", "false");
        return;
      }

      const granted = await requestSmsPermission();
      if (!granted) {
        setAutoSyncEnabled(false);
        await AsyncStorage.setItem("@auto_sync_enabled", "false");
        return;
      }

      setAutoSyncEnabled(true);
      await AsyncStorage.setItem("@auto_sync_enabled", "true");

      const result = await queueSMSApprovalNotifications({ userId: user?.uid, initialLookback: true });
      await registerSMSBackgroundSync();
      if (result.queued > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err: any) {
      console.warn("Silent SMS Sync Error:", err);
      setAutoSyncEnabled(false);
      await AsyncStorage.setItem("@auto_sync_enabled", "false");
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    headerGrad: { paddingTop: topPad + 16, paddingBottom: 40, paddingHorizontal: 20 },
    headerTitle: {
      fontSize: 24,
      fontWeight: "700" as const,
      fontFamily: "Inter_700Bold",
      color: "#fff",
      marginBottom: 20,
    },
    avatarCenteredWrap: {
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 14,
    },
    avatarWrap: {
      position: "relative",
    },
    avatar: {
      width: 88,
      height: 88,
      borderRadius: 28,
      backgroundColor: isDark ? "rgba(248,250,247,0.08)" : "rgba(255,255,255,0.72)",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      borderWidth: 2,
      borderColor: "rgba(255,255,255,0.3)",
    },
    avatarImage: {
      width: 84,
      height: 84,
      borderRadius: 26,
    },
    cameraBtn: {
      position: "absolute",
      bottom: -2,
      right: -2,
      width: 28,
      height: 28,
      borderRadius: 9,
      backgroundColor: colors.card,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 3,
    },
    nameCenteredRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginBottom: 6,
      paddingHorizontal: 20,
    },
    nameInputCentered: {
      fontSize: 22,
      fontWeight: "700" as const,
      fontFamily: "Inter_700Bold",
      color: "#fff",
      borderBottomWidth: 1.5,
      borderBottomColor: "rgba(255,255,255,0.5)",
      paddingBottom: 2,
      textAlign: "center",
      minWidth: 160,
    },
    nameTextCentered: {
      fontSize: 22,
      fontWeight: "700" as const,
      fontFamily: "Inter_700Bold",
      color: "#fff",
      textAlign: "center",
    },
    editNameBtnCentered: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: "rgba(255,255,255,0.15)",
      alignItems: "center",
      justifyContent: "center",
    },
    usernameTextCentered: {
      fontSize: 14,
      fontWeight: "600" as const,
      fontFamily: "Inter_600SemiBold",
      color: isDark ? "#5EEAD4" : "#115E59",
      textAlign: "center",
      marginBottom: 4,
    },
    emailTextCentered: {
      fontSize: 13,
      fontWeight: "400" as const,
      fontFamily: "Inter_400Regular",
      color: isDark ? "rgba(248,250,247,0.72)" : "rgba(23,33,31,0.70)",
      textAlign: "center",
    },
    section: {
      marginHorizontal: 16,
      marginTop: 16,
      overflow: "hidden",
      ...surfaceStyle(colors),
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: "600" as const,
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
      letterSpacing: 0.8,
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 8,
    },
    scrollContent: {
      paddingBottom: Platform.OS === "web" ? 34 + 84 : insets.bottom + 84,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(15, 23, 42, 0.52)",
      justifyContent: "flex-end",
    },
    sheet: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 18,
      paddingTop: 10,
      paddingBottom: insets.bottom + 18,
      ...surfaceStyle(colors),
    },
    sheetHandle: {
      width: 42,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: "center",
      marginBottom: 16,
    },
    sheetTitle: {
      fontSize: 18,
      fontWeight: "700" as const,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      textAlign: "center",
    },
    sheetSubtitle: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      textAlign: "center",
      marginTop: 6,
      marginBottom: 18,
      lineHeight: 18,
    },
    sheetAction: {
      minHeight: 54,
      borderRadius: 14,
      backgroundColor: isDark ? "rgba(248,250,247,0.05)" : colors.muted,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      gap: 12,
      marginBottom: 10,
    },
    sheetActionIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      ...iconSurface(colors),
    },
    sheetActionText: {
      flex: 1,
      fontSize: 15,
      fontWeight: "700" as const,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    sheetCancel: {
      minHeight: 50,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 4,
    },
    sheetCancelText: {
      fontSize: 15,
      fontWeight: "700" as const,
      fontFamily: "Inter_700Bold",
      color: colors.mutedForeground,
    },
    dangerText: {
      color: "#ef4444",
    },
    previewBackdrop: {
      flex: 1,
      backgroundColor: "rgba(15, 23, 42, 0.72)",
      justifyContent: "center",
      paddingHorizontal: 20,
    },
    previewCard: {
      borderRadius: 24,
      padding: 18,
      ...surfaceStyle(colors),
    },
    previewTitle: {
      fontSize: 18,
      fontWeight: "700" as const,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      textAlign: "center",
    },
    previewSubtitle: {
      fontSize: 13,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      textAlign: "center",
      marginTop: 6,
      marginBottom: 16,
      lineHeight: 18,
    },
    avatarPreviewFrame: {
      width: "100%",
      aspectRatio: 1,
      maxHeight: 360,
      borderRadius: 28,
      overflow: "hidden",
      alignSelf: "center",
      backgroundColor: colors.muted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    avatarPreviewImage: {
      width: "100%",
      height: "100%",
    },
    previewMeta: {
      color: colors.mutedForeground,
      fontSize: 12,
      fontFamily: "Inter_500Medium",
      textAlign: "center",
      marginTop: 12,
    },
    previewActions: {
      flexDirection: "row",
      gap: 10,
      marginTop: 18,
    },
    previewSecondaryBtn: {
      flex: 1,
      minHeight: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    previewPrimaryBtn: {
      flex: 1,
      minHeight: 48,
      borderRadius: 14,
      overflow: "hidden",
    },
    previewPrimaryGrad: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    previewSecondaryText: {
      fontSize: 14,
      fontWeight: "700" as const,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    previewPrimaryText: {
      fontSize: 14,
      fontWeight: "700" as const,
      fontFamily: "Inter_700Bold",
      color: "#fff",
    },
  });

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={gradients.hero}
          style={styles.headerGrad}
        >
          <Text style={styles.headerTitle}>Profile</Text>
          
          <View style={styles.avatarCenteredWrap}>
            <TouchableOpacity style={styles.avatarWrap} onPress={handleAvatarPress} activeOpacity={0.8}>
              <View style={styles.avatar}>
                {user?.avatarUri && !avatarLoadFailed ? (
                  <Image 
                    source={{ uri: user.avatarUri }} 
                    style={styles.avatarImage} 
                    onError={() => setAvatarLoadFailed(true)}
                  />
                ) : (
                  <Image
                    source={getFallbackAvatar(isDark)}
                    style={styles.avatarImage}
                  />
                )}
              </View>
              <View style={styles.cameraBtn}>
                <Feather name="camera" size={13} color={colors.primary} />
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.nameCenteredRow}>
            {editingName ? (
              <TextInput
                style={styles.nameInputCentered}
                value={nameVal}
                onChangeText={setNameVal}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={saveName}
                onBlur={saveName}
                placeholderTextColor="rgba(255,255,255,0.5)"
              />
            ) : (
              <Text style={styles.nameTextCentered}>{user?.name}</Text>
            )}
            <TouchableOpacity
              style={styles.editNameBtnCentered}
              onPress={() => { setNameVal(user?.name || ""); setEditingName((v) => !v); }}
            >
              <Feather name={editingName ? "check" : "edit-2"} size={14} color="#fff" />
            </TouchableOpacity>
          </View>

          <Text style={styles.usernameTextCentered}>@{user?.username}</Text>
          <Text style={styles.emailTextCentered}>{user?.email}</Text>
        </LinearGradient>

        {/* Preferences */}
        <View style={[styles.section, { marginTop: -20 }]}>
          <Text style={styles.sectionLabel}>PREFERENCES</Text>
          <MenuItem
            icon={theme === "dark" ? "moon" : "sun"}
            label="Dark Mode"
            sublabel="Enable dark visual styling"
            onPress={() => {
              const nextTheme = theme === "dark" ? "light" : "dark";
              setTheme(nextTheme);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            rightElement={
              <Switch
                value={theme === "dark"}
                onValueChange={(newValue) => {
                  setTheme(newValue ? "dark" : "light");
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            }
          />
          <Divider />
          <MenuItem
            icon="message-square"
            label="Auto-Sync SMS Expenses"
            sublabel="Read GPay/UPI messages"
            onPress={() => handleToggleAutoSync(!autoSyncEnabled)}
            rightElement={
              <Switch
                value={autoSyncEnabled}
                onValueChange={handleToggleAutoSync}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            }
          />
        </View>

        {/* Support */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SUPPORT</Text>
          <MenuItem
            icon="life-buoy"
            label="Raise Support Ticket"
            sublabel="Direct customer desk"
            onPress={() => setShowSupportModal(true)}
          />
          <Divider />
          <MenuItem
            icon="help-circle"
            label="Help & FAQ"
            sublabel="Common questions"
            onPress={() => router.push("/faq")}
          />
          <Divider />
          <MenuItem
            icon="info"
            label="About WhisperLedger"
            sublabel="Version 1.0.0"
            onPress={() => router.push("/about")}
          />
        </View>

        {/* Danger */}
        <View style={styles.section}>
          <MenuItem icon="log-out" label="Sign Out" onPress={handleLogout} danger />
        </View>
      </ScrollView>

      <PrivacyConsentModal
        visible={showConsentModal}
        onClose={() => setShowConsentModal(false)}
        onConfirmConsent={proceedWithSmsSync}
      />

      <SupportModal
        visible={showSupportModal}
        onClose={() => setShowSupportModal(false)}
      />

      <Modal
        visible={showAvatarOptions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAvatarOptions(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowAvatarOptions(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Profile Photo</Text>
            <Text style={styles.sheetSubtitle}>
              Choose a photo and preview the avatar before saving it.
            </Text>

            <TouchableOpacity style={styles.sheetAction} activeOpacity={0.8} onPress={pickAvatar}>
              <View style={styles.sheetActionIcon}>
                <Feather name="image" size={18} color={colors.primary} />
              </View>
              <Text style={styles.sheetActionText}>Choose from Photos</Text>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>

            {!!user?.avatarUri && !avatarLoadFailed && (
              <TouchableOpacity style={styles.sheetAction} activeOpacity={0.8} onPress={removeAvatar}>
                <View style={[styles.sheetActionIcon, { backgroundColor: "rgba(239, 68, 68, 0.12)" }]}>
                  <Feather name="trash-2" size={18} color="#ef4444" />
                </View>
                <Text style={[styles.sheetActionText, styles.dangerText]}>Remove Photo</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.sheetCancel}
              activeOpacity={0.8}
              onPress={() => setShowAvatarOptions(false)}
            >
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showAvatarPreview}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!savingAvatar) {
            setShowAvatarPreview(false);
            setPendingAvatar(null);
          }
        }}
      >
        <View style={styles.previewBackdrop}>
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>Preview Photo</Text>
            <Text style={styles.previewSubtitle}>
              This is how the image will appear on your profile.
            </Text>

            <View style={styles.avatarPreviewFrame}>
              {!!pendingAvatar?.uri && (
                <Image
                  source={{ uri: pendingAvatar.uri }}
                  style={styles.avatarPreviewImage}
                  resizeMode="cover"
                />
              )}
            </View>

            {!!pendingAvatar?.width && !!pendingAvatar?.height && (
              <Text style={styles.previewMeta}>
                {pendingAvatar.width} x {pendingAvatar.height}px
              </Text>
            )}

            <View style={styles.previewActions}>
              <TouchableOpacity
                style={styles.previewSecondaryBtn}
                activeOpacity={0.8}
                disabled={savingAvatar}
                onPress={() => {
                  setShowAvatarPreview(false);
                  setPendingAvatar(null);
                  pickAvatar();
                }}
              >
                <Text style={styles.previewSecondaryText}>Choose Again</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.previewPrimaryBtn, savingAvatar && { opacity: 0.75 }]}
                activeOpacity={0.8}
                disabled={savingAvatar}
                onPress={savePendingAvatar}
              >
                <LinearGradient
                  colors={gradients.primary}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.previewPrimaryGrad}
                >
                  <Text style={styles.previewPrimaryText}>
                    {savingAvatar ? "Saving..." : "Use Photo"}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
