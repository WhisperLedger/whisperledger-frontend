import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useHousehold } from "@/context/HouseholdContext";
import { useColors } from "@/hooks/useColors";
import { Household, HouseholdMember } from "@/types/household";
import { isDarkPalette } from "@/utils/designSystem";
import { safeHaptics } from "@/utils/haptics";

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function HouseholdManagementModal({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const isDark = isDarkPalette(colors);
  const { user } = useAuth();
  const {
    currentHousehold,
    households,
    setCurrentHousehold,
    setActiveSpace,
    createHousehold,
    joinHousehold,
    leaveHousehold,
    deleteHousehold,
  } = useHousehold();

  const [activeTab, setActiveTab] = useState<"flats" | "members" | "join" | "create">(
    households.length > 1 ? "flats" : "members"
  );
  const [newHouseholdName, setNewHouseholdName] = useState("");
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [createdHouseholdSuccess, setCreatedHouseholdSuccess] = useState<Household | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!visible) {
      setCreatedHouseholdSuccess(null);
      setNewHouseholdName("");
      setInviteCodeInput("");
    }
  }, [visible]);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardHeight(0)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const members: HouseholdMember[] = Object.values(currentHousehold?.members || {});
  const isCreatorOrAdmin =
    !currentHousehold ||
    currentHousehold.createdBy === user?.uid ||
    currentHousehold.members[user?.uid || ""]?.role === "admin" ||
    members.length <= 1;

  const handleCopyCode = async (codeToCopy?: string) => {
    const code = codeToCopy || currentHousehold?.inviteCode;
    if (!code) return;
    try {
      let ClipboardModule: any = null;
      try {
        ClipboardModule = require("expo-clipboard");
      } catch {
        try {
          ClipboardModule = require("react-native").Clipboard;
        } catch {}
      }
      if (ClipboardModule?.setStringAsync) {
        await ClipboardModule.setStringAsync(code);
      } else if (ClipboardModule?.setString) {
        ClipboardModule.setString(code);
      }
    } catch {}
    setCopied(true);
    safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareCode = async (codeToShare?: string, name?: string) => {
    const code = codeToShare || currentHousehold?.inviteCode;
    const flatName = name || currentHousehold?.name || "our flat";
    if (!code) return;
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message: `Join our flat "${flatName}" on WhisperLedger! Enter invite code: ${code}`,
      });
    } catch {
      // ignore
    }
  };

  const handleCreate = async () => {
    if (!newHouseholdName.trim()) {
      Alert.alert("Required", "Please enter a household name.");
      return;
    }
    setLoading(true);
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const res = await createHousehold(newHouseholdName.trim());
    setLoading(false);
    if (res.success && res.household) {
      safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNewHouseholdName("");
      setCreatedHouseholdSuccess(res.household);
    } else {
      Alert.alert("Error", res.error || "Could not create household");
    }
  };

  const handleJoin = async () => {
    if (!inviteCodeInput.trim()) {
      Alert.alert("Required", "Please enter a 6-character invite code.");
      return;
    }
    setLoading(true);
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const res = await joinHousehold(inviteCodeInput.trim());
    setLoading(false);
    if (res.success) {
      safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setInviteCodeInput("");
      onClose();
    } else {
      Alert.alert("Join Failed", res.error || "Could not find household with this code. Please make sure the code is correct.");
    }
  };

  const handleDeleteHousehold = () => {
    if (!currentHousehold) return;
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Delete Household",
      `Are you sure you want to permanently delete "${currentHousehold.name}" and remove all flat data? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Forever",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            const res = await deleteHousehold(currentHousehold.id);
            setLoading(false);
            if (res.success) {
              safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              onClose();
            } else {
              Alert.alert("Delete Failed", res.error || "Could not delete household.");
            }
          },
        },
      ]
    );
  };

  const handleLeave = () => {
    if (!currentHousehold) return;
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      "Leave Household",
      `Are you sure you want to leave "${currentHousehold.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            const res = await leaveHousehold(currentHousehold.id, true);
            setLoading(false);
            if (res.success) {
              safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              onClose();
            } else {
              Alert.alert("Cannot Leave", res.error);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: colors.foreground }]}>
                Household Management
              </Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                {currentHousehold ? currentHousehold.name : "Create or join a space"}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.closeBtn,
                { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" },
              ]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Feather name="x" size={18} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          {createdHouseholdSuccess ? (
            <View style={{ gap: 18, paddingVertical: 8, alignItems: "center" }}>
              <View
                style={[
                  styles.successIconWrap,
                  { backgroundColor: isDark ? "rgba(16, 185, 129, 0.15)" : "#ECFDF5" },
                ]}
              >
                <Feather name="check" size={30} color="#10B981" />
              </View>

              <View style={{ alignItems: "center", gap: 4 }}>
                <Text style={[styles.successTitle, { color: colors.foreground }]}>
                  Household created
                </Text>
                <Text style={[styles.successSub, { color: colors.mutedForeground }]}>
                  "{createdHouseholdSuccess.name}" is ready for splitting
                </Text>
              </View>

              {/* Big Highlighted Invite Box */}
              <View
                style={[
                  styles.successInviteCard,
                  {
                    backgroundColor: isDark ? "rgba(56, 130, 255, 0.1)" : "#EFF6FF",
                    borderColor: colors.primary,
                  },
                ]}
              >
                <Text style={[styles.successCodeLabel, { color: colors.mutedForeground }]}>
                  YOUR FLAT'S INVITE CODE
                </Text>
                <Text style={[styles.successCodeValue, { color: colors.primary }]}>
                  {createdHouseholdSuccess.inviteCode}
                </Text>
                <Text style={[styles.successCodeHint, { color: colors.mutedForeground }]}>
                  Share this 6-letter code with your flatmates. Once they join, everyone can add shared spends, split rent, and settle dues.
                </Text>

                <View style={{ flexDirection: "row", gap: 10, marginTop: 6, width: "100%" }}>
                  <TouchableOpacity
                    style={[styles.shareActionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => handleCopyCode(createdHouseholdSuccess.inviteCode)}
                    activeOpacity={0.7}
                  >
                    <Feather name={copied ? "check" : "copy"} size={15} color={colors.primary} />
                    <Text style={[styles.shareActionText, { color: colors.primary }]}>
                      {copied ? "Copied" : "Copy Code"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.shareActionBtn, { backgroundColor: colors.primary }]}
                    onPress={() => handleShareCode(createdHouseholdSuccess.inviteCode, createdHouseholdSuccess.name)}
                    activeOpacity={0.8}
                  >
                    <Feather name="share-2" size={15} color="#FFFFFF" />
                    <Text style={[styles.shareActionText, { color: "#FFFFFF" }]}>
                      Share via Apps
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.startSplittingBtn, { backgroundColor: colors.primary }]}
                onPress={() => {
                  setCreatedHouseholdSuccess(null);
                  onClose();
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.startSplittingText}>Open shared spending</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Navigation Tabs */}
              <View style={styles.tabsRow}>
                <TouchableOpacity
                  style={[
                    styles.tabBtn,
                    activeTab === "flats" && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
                  ]}
                  onPress={() => setActiveTab("flats")}
                >
                  <Text
                    style={[
                      styles.tabText,
                      {
                        color: activeTab === "flats" ? colors.primary : colors.mutedForeground,
                        fontFamily: activeTab === "flats" ? "Inter_600SemiBold" : "Inter_500Medium",
                      },
                    ]}
                  >
                    My Flats ({households.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.tabBtn,
                    activeTab === "members" && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
                  ]}
                  onPress={() => setActiveTab("members")}
                >
                  <Text
                    style={[
                      styles.tabText,
                      {
                        color: activeTab === "members" ? colors.primary : colors.mutedForeground,
                        fontFamily: activeTab === "members" ? "Inter_600SemiBold" : "Inter_500Medium",
                      },
                    ]}
                  >
                    Flatmates
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.tabBtn,
                    activeTab === "join" && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
                  ]}
                  onPress={() => setActiveTab("join")}
                >
                  <Text
                    style={[
                      styles.tabText,
                      {
                        color: activeTab === "join" ? colors.primary : colors.mutedForeground,
                        fontFamily: activeTab === "join" ? "Inter_600SemiBold" : "Inter_500Medium",
                      },
                    ]}
                  >
                    Join
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.tabBtn,
                    activeTab === "create" && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
                  ]}
                  onPress={() => setActiveTab("create")}
                >
                  <Text
                    style={[
                      styles.tabText,
                      {
                        color: activeTab === "create" ? colors.primary : colors.mutedForeground,
                        fontFamily: activeTab === "create" ? "Inter_600SemiBold" : "Inter_500Medium",
                      },
                    ]}
                  >
                    Create
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView 
                ref={scrollRef}
                showsVerticalScrollIndicator={false} 
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ gap: 16, paddingBottom: 24 }}
              >
            {/* TAB: ALL FLATS (Multiple Household Switcher) */}
            {activeTab === "flats" && (
              <View style={{ gap: 12 }}>
                {households.length === 0 ? (
                  <View style={styles.noHouseholdWrap}>
                    <Feather name="home" size={24} color={colors.mutedForeground} />
                    <Text style={[styles.noHouseholdText, { color: colors.mutedForeground }]}>
                      You have not created or joined any flats yet. Tap "Create" or "Join" above to get started.
                    </Text>
                  </View>
                ) : (
                  households.map((h) => {
                    const isSelected = currentHousehold?.id === h.id;
                    const memberCount = Object.keys(h.members || {}).length;

                    return (
                      <View
                        key={h.id}
                        style={{
                          padding: 14,
                          borderRadius: 16,
                          backgroundColor: isDark
                            ? isSelected
                              ? "rgba(56, 130, 255, 0.15)"
                              : "rgba(255,255,255,0.04)"
                            : isSelected
                            ? "rgba(0, 102, 255, 0.08)"
                            : "rgba(0,0,0,0.03)",
                          borderWidth: 1,
                          borderColor: isSelected ? colors.primary : colors.border,
                          gap: 10,
                        }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                          <View style={{ gap: 2, flex: 1 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                              <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 16 }}>
                                {h.name}
                              </Text>
                              {isSelected && (
                                <View style={{ backgroundColor: "#10B981", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, flexDirection: "row", alignItems: "center", gap: 4 }}>
                                  <Feather name="check" size={10} color="#FFFFFF" />
                                  <Text style={{ color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 10 }}>ACTIVE</Text>
                                </View>
                              )}
                            </View>
                            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                              {memberCount} member{memberCount > 1 ? "s" : ""} · Invite Code: <Text style={{ fontFamily: "Inter_700Bold", color: colors.primary }}>{h.inviteCode}</Text>
                            </Text>
                          </View>
                        </View>

                        <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                          {!isSelected ? (
                            <TouchableOpacity
                              style={{
                                flex: 1,
                                backgroundColor: colors.primary,
                                paddingVertical: 8,
                                borderRadius: 10,
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                              onPress={() => {
                                safeHaptics.selectionAsync();
                                setCurrentHousehold(h);
                                setActiveSpace("household");
                                setActiveTab("members");
                              }}
                              activeOpacity={0.8}
                            >
                              <Text style={{ color: "#FFFFFF", fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                                Switch to this Flat
                              </Text>
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity
                              style={{
                                flex: 1,
                                backgroundColor: isDark ? "rgba(56, 130, 255, 0.2)" : "rgba(0, 102, 255, 0.1)",
                                paddingVertical: 8,
                                borderRadius: 10,
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                              onPress={() => setActiveTab("members")}
                              activeOpacity={0.8}
                            >
                              <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                                View Flatmates & Ledger
                              </Text>
                            </TouchableOpacity>
                          )}

                          <TouchableOpacity
                            style={{
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                              borderRadius: 10,
                              borderWidth: 1,
                              borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                            onPress={() => handleShareCode(h.inviteCode, h.name)}
                            activeOpacity={0.7}
                          >
                            <Feather name="share-2" size={14} color={colors.foreground} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            )}

            {/* TAB: MEMBERS */}
            {activeTab === "members" && (
              <>
                {currentHousehold ? (
                  <>
                    {/* Invite Code Box */}
                    <View
                      style={[
                        styles.inviteBox,
                        {
                          backgroundColor: isDark
                            ? "rgba(56, 130, 255, 0.12)"
                            : "rgba(0, 102, 255, 0.06)",
                          borderColor: colors.primary,
                        },
                      ]}
                    >
                      <View>
                        <Text style={[styles.inviteLabel, { color: colors.mutedForeground }]}>
                          HOUSEHOLD INVITE CODE
                        </Text>
                        <Text style={[styles.inviteCodeText, { color: colors.primary }]}>
                          {currentHousehold.inviteCode}
                        </Text>
                      </View>

                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <TouchableOpacity
                          style={[styles.actionChip, { backgroundColor: colors.card }]}
                          onPress={() => handleCopyCode()}
                          activeOpacity={0.7}
                        >
                          <Feather
                            name={copied ? "check" : "copy"}
                            size={14}
                            color={colors.primary}
                          />
                          <Text style={[styles.actionChipText, { color: colors.primary }]}>
                            {copied ? "Copied" : "Copy"}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.actionChip, { backgroundColor: colors.card }]}
                          onPress={() => handleShareCode()}
                          activeOpacity={0.7}
                        >
                          <Feather name="share-2" size={14} color={colors.primary} />
                          <Text style={[styles.actionChipText, { color: colors.primary }]}>
                            Share
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Members List */}
                    <Text style={[styles.sectionHeading, { color: colors.mutedForeground }]}>
                      MEMBERS ({members.length})
                    </Text>

                    <View style={styles.membersList}>
                      {members.map((m) => {
                        const isMe = m.uid === user?.uid;
                        const isAdmin = m.role === "admin";

                        return (
                          <View
                            key={m.uid}
                            style={[
                              styles.memberItem,
                              {
                                backgroundColor: isDark
                                  ? "rgba(255, 255, 255, 0.04)"
                                  : "rgba(0, 0, 0, 0.02)",
                                borderColor: colors.border,
                              },
                            ]}
                          >
                            <View style={styles.memberLeft}>
                              <View
                                style={[
                                  styles.avatar,
                                  {
                                    backgroundColor: isDark
                                      ? "rgba(255,255,255,0.1)"
                                      : "rgba(0,0,0,0.06)",
                                  },
                                ]}
                              >
                                <Text style={[styles.avatarText, { color: colors.foreground }]}>
                                  {m.name.charAt(0).toUpperCase()}
                                </Text>
                              </View>

                              <View>
                                <Text
                                  style={[
                                    styles.memberName,
                                    {
                                      color: colors.foreground,
                                      fontFamily: isMe ? "Inter_600SemiBold" : "Inter_500Medium",
                                    },
                                  ]}
                                >
                                  {m.name} {isMe && "(You)"}
                                </Text>
                                <Text
                                  style={[styles.memberEmail, { color: colors.mutedForeground }]}
                                >
                                  {m.email || "No email"}
                                </Text>
                              </View>
                            </View>

                            <View
                              style={[
                                styles.roleBadge,
                                {
                                  backgroundColor: isAdmin
                                    ? isDark
                                      ? "rgba(245, 158, 11, 0.2)"
                                      : "rgba(245, 158, 11, 0.12)"
                                    : isDark
                                    ? "rgba(255,255,255,0.06)"
                                    : "rgba(0,0,0,0.04)",
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.roleBadgeText,
                                  { color: isAdmin ? "#F59E0B" : colors.mutedForeground },
                                ]}
                              >
                                {isAdmin ? "Admin" : "Member"}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>

                    {/* Action Button: Delete Household for Admin, Leave for Member */}
                    {isCreatorOrAdmin ? (
                      <TouchableOpacity
                        style={[
                          styles.leaveBtn,
                          {
                            borderColor: "#EF4444",
                            backgroundColor: isDark ? "rgba(239,68,68,0.12)" : "rgba(239,68,68,0.06)",
                          },
                        ]}
                        onPress={handleDeleteHousehold}
                        disabled={loading}
                        activeOpacity={0.7}
                      >
                        <Feather name="trash-2" size={15} color="#EF4444" />
                        <Text style={[styles.leaveBtnText, { color: "#EF4444" }]}>Delete Household</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[styles.leaveBtn, { borderColor: "#EF4444" }]}
                        onPress={handleLeave}
                        disabled={loading}
                        activeOpacity={0.7}
                      >
                        <Feather name="log-out" size={15} color="#EF4444" />
                        <Text style={styles.leaveBtnText}>Leave Household</Text>
                      </TouchableOpacity>
                    )}
                  </>
                ) : (
                  <View style={styles.noHouseholdWrap}>
                    <Feather name="info" size={24} color={colors.mutedForeground} />
                    <Text style={[styles.noHouseholdText, { color: colors.mutedForeground }]}>
                      You are not part of any household yet. Use the tabs above to Create or Join one.
                    </Text>
                  </View>
                )}
              </>
            )}

            {/* TAB: JOIN */}
            {activeTab === "join" && (
              <View style={{ gap: 14 }}>
                <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>
                  ENTER 6-CHARACTER INVITE CODE
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.02)",
                      borderColor: colors.border,
                      color: colors.foreground,
                      letterSpacing: 3,
                      fontSize: 18,
                      textAlign: "center",
                      fontFamily: "Inter_700Bold",
                    },
                  ]}
                  placeholder="e.g. WL8K9P"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="characters"
                  maxLength={10}
                  value={inviteCodeInput}
                  onChangeText={setInviteCodeInput}
                  onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120)}
                />

                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                  onPress={handleJoin}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Feather name="user-plus" size={16} color="#FFFFFF" />
                      <Text style={styles.primaryBtnText}>Join Household</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* TAB: CREATE */}
            {activeTab === "create" && (
              <View style={{ gap: 14 }}>
                <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>
                  HOUSEHOLD NAME
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.02)",
                      borderColor: colors.border,
                      color: colors.foreground,
                    },
                  ]}
                  placeholder="e.g. Greenwood Flat 402"
                  placeholderTextColor={colors.mutedForeground}
                  value={newHouseholdName}
                  onChangeText={setNewHouseholdName}
                  onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120)}
                />

                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                  onPress={handleCreate}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Feather name="plus-circle" size={16} color="#FFFFFF" />
                      <Text style={styles.primaryBtnText}>Create Household</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </>
      )}
    </View>
  </KeyboardAvoidingView>
</Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    padding: 20,
    maxHeight: "90%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  tabsRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.08)",
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  tabText: {
    fontSize: 13,
  },
  inviteBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  inviteLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
  inviteCodeText: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
    marginTop: 2,
  },
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  actionChipText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  sectionHeading: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
  membersList: {
    gap: 8,
  },
  memberItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  memberLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  memberName: {
    fontSize: 13,
  },
  memberEmail: {
    fontSize: 11,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  roleBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  leaveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 10,
  },
  leaveBtnText: {
    color: "#EF4444",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  noHouseholdWrap: {
    padding: 24,
    alignItems: "center",
    gap: 10,
  },
  noHouseholdText: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  inputLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 6,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  successIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  successTitle: {
    fontSize: 19,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  successSub: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  successInviteCard: {
    width: "100%",
    padding: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: "center",
    gap: 6,
  },
  successCodeLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  successCodeValue: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: 4,
    marginVertical: 4,
  },
  successCodeHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 17,
  },
  shareActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  shareActionText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  startSplittingBtn: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    borderRadius: 16,
    marginTop: 4,
  },
  startSplittingText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
});
