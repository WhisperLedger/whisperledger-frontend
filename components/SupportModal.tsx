import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { db } from "@/lib/firebase";
import { safeHaptics } from "@/utils/haptics";

interface SupportModalProps {
  visible: boolean;
  onClose: () => void;
  initialSubject?: string;
}

export default function SupportModal({
  visible,
  onClose,
  initialSubject = "",
}: SupportModalProps) {
  const colors = useColors();
  const { user } = useAuth();

  const [subject, setSubject] = useState(initialSubject);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) {
      Alert.alert("Required Fields", "Please enter both a subject and details for your ticket.");
      return;
    }

    if (!user) {
      Alert.alert("Authentication Required", "Please log in to submit a support ticket.");
      return;
    }

    safeHaptics.impactAsync();
    setSending(true);
    try {
      await addDoc(collection(db, "support_cases"), {
        userId: user.uid,
        userEmail: user.email || "",
        userName: user.name || "Valued User",
        subject: subject.trim(),
        message: message.trim(),
        status: "received",
        createdAt: serverTimestamp(),
      });

      safeHaptics.notificationAsync();
      setSubmitted(true);
    } catch (e: any) {
      console.warn("Support case submission failed:", e);
      Alert.alert("Submission Error", "Could not submit support ticket: " + (e.message || "Unknown error"));
    } finally {
      setSending(false);
    }
  };

  const handleResetAndClose = () => {
    setSubject("");
    setMessage("");
    setSubmitted(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      statusBarTranslucent={true}
      onRequestClose={handleResetAndClose}
    >
      <TouchableWithoutFeedback onPress={handleResetAndClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={[styles.iconWrap, { backgroundColor: "rgba(99, 102, 241, 0.15)" }]}>
                <Feather name="life-buoy" size={20} color={colors.primary} />
              </View>
              <Text style={[styles.title, { color: colors.foreground }]}>
                {submitted ? "Ticket Received! ✅" : "New Support Ticket"}
              </Text>
            </View>

            <TouchableOpacity onPress={handleResetAndClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {submitted ? (
            <View style={styles.successContent}>
              <View style={styles.successBadge}>
                <Feather name="check-circle" size={48} color="#10B981" />
              </View>
              <Text style={[styles.successTitle, { color: colors.foreground }]}>
                Support Case Opened!
              </Text>
              <Text style={[styles.successBody, { color: colors.mutedForeground }]}>
                We have logged your ticket with our dedicated customer team. A response will be sent directly to <Text style={{ color: colors.primary, fontWeight: "700" }}>{user?.email || "your registered email"}</Text> shortly.
              </Text>

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                onPress={handleResetAndClose}
                activeOpacity={0.85}
              >
                <Text style={styles.actionBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.label, { color: colors.foreground }]}>SUBJECT / CATEGORY</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: colors.foreground,
                    borderColor: colors.border,
                    backgroundColor: colors.muted,
                  },
                ]}
                placeholder="e.g., Money refund query, SMS auto-sync issue..."
                placeholderTextColor={colors.mutedForeground}
                value={subject}
                onChangeText={setSubject}
                editable={!sending}
              />

              <Text style={[styles.label, { color: colors.foreground, marginTop: 14 }]}>
                DESCRIPTION & DETAILS
              </Text>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  {
                    color: colors.foreground,
                    borderColor: colors.border,
                    backgroundColor: colors.muted,
                  },
                ]}
                placeholder="Explain what happened or what help you need..."
                placeholderTextColor={colors.mutedForeground}
                value={message}
                onChangeText={setMessage}
                multiline={true}
                numberOfLines={5}
                textAlignVertical="top"
                editable={!sending}
              />

              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  {
                    backgroundColor: colors.primary,
                    opacity: sending || !subject.trim() || !message.trim() ? 0.5 : 1,
                  },
                ]}
                onPress={handleSubmit}
                disabled={sending || !subject.trim() || !message.trim()}
                activeOpacity={0.85}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Feather name="send" size={16} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.actionBtnText}>Submit Support Ticket</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
  },
  container: {
    flex: 1,
    justifyContent: "flex-end",
  },
  card: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    maxHeight: "85%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    fontWeight: "700",
  },
  closeBtn: {
    padding: 6,
  },
  scrollContent: {
    paddingTop: 16,
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    width: "100%",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  textArea: {
    height: 120,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 20,
  },
  actionBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600",
  },
  successContent: {
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 12,
  },
  successBadge: {
    marginBottom: 14,
  },
  successTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    fontWeight: "700",
    marginBottom: 8,
  },
  successBody: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
});
