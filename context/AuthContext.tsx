import { 
  onAuthStateChanged, 
  signInWithCredential, 
  GoogleAuthProvider, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile as updateProfileFirebase,
  User as FirebaseUser,
  sendPasswordResetEmail,
  sendEmailVerification,
  deleteUser
} from "firebase/auth";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, setDoc, writeBatch } from "firebase/firestore";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { db, auth } from "../lib/firebase";
import { api } from "../lib/api";
import { runtimeConfig } from "@/config/runtime";
import { SecureSession, SECURE_KEYS } from "../lib/secureStorage";
import { validateEmail, validateFullName, validateUsername } from "@/utils/validation";
import { validatePassword } from "@/utils/passwordValidator";

WebBrowser.maybeCompleteAuthSession();

function getGoogleSigninModule() {
  if (Constants.appOwnership === "expo") return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("@react-native-google-signin/google-signin");
    return mod?.GoogleSignin || null;
  } catch {
    return null;
  }
}

interface User {
  uid: string;
  name: string;
  email: string;
  avatarUri?: string;
  avatarResizeMode?: "cover" | "contain";
  username?: string;
  bio?: string;
  plan?: string;
  isPro?: boolean;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthReady: boolean;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  register: (username: string, pass: string, name: string, email: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<Omit<User, "uid" | "email">>) => Promise<void>;
  forgotPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const isSigningOutRef = useRef(false);
  const isRegisteringRef = useRef(false);

  useEffect(() => {
    // Initial boot cache restore
    // Only Firebase uses a cached display profile during boot. API mode must
    // validate its bearer token before rendering an authenticated session.
    const restoreCache = runtimeConfig.dataBackend !== "api"
      ? AsyncStorage.getItem("@last_active_user_session")
      : Promise.resolve(null);
    restoreCache
      .then((cachedStr) => {
        if (cachedStr) {
          try {
            const cachedUser = JSON.parse(cachedStr);
            if (cachedUser && cachedUser.uid) {
              setUser(cachedUser);
            }
          } catch (e) {
            console.error("Failed to parse initial cached user:", e);
          }
        }
      })
      .finally(() => {
        setIsLoading(false);
      });

    if (runtimeConfig.dataBackend === "api") {
      api.getMe()
        .then(async (res) => {
          const apiUser = res.data?.user || (res.data?.id ? res.data : null);
          if (apiUser) {
            const isPro = apiUser.plan === "pro";
            const updatedUser: User = {
              uid: apiUser.id,
              name: apiUser.full_name || "User",
              email: apiUser.email || "",
              avatarUri: apiUser.avatar_url || undefined,
              username: apiUser.email?.split("@")[0] || "user",
              plan: apiUser.plan || "starter_free",
              isPro: isPro,
              role: apiUser.role || "user",
            };
            setUser(updatedUser);
            AsyncStorage.setItem("@last_active_user_session", JSON.stringify(updatedUser)).catch(() => null);
          }
        })
	    .catch(async () => {
	      // A cached display profile is not proof of identity. Never recreate a
	      // server session from it; require a normal sign-in instead.
	      setUser(null);
	      await AsyncStorage.removeItem("@last_active_user_session").catch(() => null);
        })
        .finally(() => {
          setIsAuthReady(true);
          setIsLoading(false);
        });
      return;
    }

    const GoogleSignin = getGoogleSigninModule();
    if (GoogleSignin) {
      GoogleSignin.configure({
        webClientId: "1064792050841-amo41uudlpvmuoou362ijcktfe198hdr.apps.googleusercontent.com",
        offlineAccess: true,
      });
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsAuthReady(true);
      if (firebaseUser) {
        const isPasswordUser = firebaseUser.providerData.some((provider) => provider.providerId === "password");
        if (isPasswordUser && !firebaseUser.emailVerified) {
          if (!isRegisteringRef.current) {
            await signOut(auth);
            setUser(null);
            await AsyncStorage.removeItem("@last_active_user_session").catch(() => null);
          }
          setIsLoading(false);
          return;
        }

        let cachedProfile: Partial<User> = {};
        try {
          const cached = await AsyncStorage.getItem(`@user_profile_${firebaseUser.uid}`);
          if (cached) cachedProfile = JSON.parse(cached);
        } catch (e) {
          console.error("Failed to load cached user profile:", e);
        }

        const updatedUser = {
          uid: firebaseUser.uid,
          name: cachedProfile.name || firebaseUser.displayName || "User",
          email: firebaseUser.email || "",
          avatarUri: cachedProfile.avatarUri || firebaseUser.photoURL || undefined,
          username: cachedProfile.username || firebaseUser.email?.split("@")[0] || "user",
          bio: cachedProfile.bio || "",
        };

        setUser(updatedUser);
        setIsLoading(false);

        // Cache this as the last active session
        AsyncStorage.setItem("@last_active_user_session", JSON.stringify(updatedUser)).catch(() => null);

        // Background user profile fetch from Firestore to restore on clean install
        const { getDoc, doc: fsDoc } = require("firebase/firestore");
        getDoc(fsDoc(db, `users/${firebaseUser.uid}`))
          .then((docSnap: any) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              const mergedUser = {
                uid: firebaseUser.uid,
                name: data.name || updatedUser.name,
                email: firebaseUser.email || "",
                avatarUri: data.avatarUri || updatedUser.avatarUri,
                username: data.username || updatedUser.username,
                bio: data.bio || updatedUser.bio,
              };
              
              setUser(mergedUser);
              AsyncStorage.setItem(`@user_profile_${firebaseUser.uid}`, JSON.stringify(mergedUser)).catch(() => null);
              AsyncStorage.setItem("@last_active_user_session", JSON.stringify(mergedUser)).catch(() => null);
            }
          })
          .catch((err: any) => {
            console.warn("⚠️ Background user profile fetch from Firestore failed:", err);
          });

        // Background user Firestore metadata sync (non-blocking)
        setDoc(doc(db, `users/${firebaseUser.uid}`), {
          uid: updatedUser.uid,
          name: updatedUser.name,
          email: updatedUser.email,
          username: updatedUser.username,
          bio: updatedUser.bio,
          emailVerified: firebaseUser.emailVerified,
          pendingVerification: false,
          verifiedAt: firebaseUser.emailVerified ? Date.now() : null,
          lastActive: Date.now(),
        }, { merge: true }).catch((err) => {
          console.warn("⚠️ Background user Firestore metadata sync skipped:", err);
        });
      } else {
        if (isSigningOutRef.current) {
          setIsLoading(false);
          return;
        }
        setUser(null);
        setIsLoading(false);
        AsyncStorage.removeItem("@last_active_user_session").catch(() => null);
      }
    });

    return unsubscribe;
  }, []);

  const login = useCallback(async (identifier: string, pass: string) => {
    const cleanEmail = identifier.trim().toLowerCase();
    if (!cleanEmail.includes("@")) {
      return { success: false, error: "Please sign in with your email address." };
    }

    if (runtimeConfig.dataBackend === "api") {
      try {
        const res = await api.login(cleanEmail, pass);
        if (res.success && res.data?.user) {
          const apiUser = res.data.user;
          const isPro = apiUser.plan === "pro";
          const updatedUser: User = {
            uid: apiUser.id,
            name: apiUser.full_name || "User",
            email: apiUser.email || cleanEmail,
            avatarUri: apiUser.avatar_url || undefined,
            username: cleanEmail.split("@")[0],
            plan: apiUser.plan || "starter_free",
            isPro: isPro,
            role: apiUser.role || "user",
          };
          setUser(updatedUser);
          await AsyncStorage.setItem("@last_active_user_session", JSON.stringify(updatedUser));
          return { success: true };
        }
        return {
          success: false,
          error: res.error?.message || "Invalid email or password",
        };
      } catch (err: any) {
        return { success: false, error: err.message || "Failed to connect to backend server" };
      }
    }

    try {
      const credential = await signInWithEmailAndPassword(auth, cleanEmail, pass);

      // Email Verification Check
      if (!credential.user.emailVerified) {
        await sendEmailVerification(credential.user).catch(() => null);
        await signOut(auth);
        return {
          success: false,
          error: "EMAIL_NOT_VERIFIED",
          userEmail: cleanEmail,
        };
      }

      await setDoc(doc(db, `users/${credential.user.uid}`), {
        uid: credential.user.uid,
        email: credential.user.email || cleanEmail,
        emailVerified: true,
        pendingVerification: false,
        verifiedAt: Date.now(),
        lastActive: Date.now(),
      }, { merge: true }).catch((err) => {
        console.warn("⚠️ Verified email metadata sync skipped:", err);
      });

      const tempUser = {
        uid: credential.user.uid,
        name: credential.user.displayName || "User",
        email: credential.user.email || "",
      };
      await AsyncStorage.setItem("@last_active_user_session", JSON.stringify(tempUser)).catch(() => null);

      return { success: true };
    } catch (error: any) {
      console.warn("❌ [AuthContext] Login Error caught:", error);
      return { success: false, error: error.message };
    }
  }, []);

  const register = useCallback(async (username: string, pass: string, name: string, email: string) => {
    isRegisteringRef.current = true;
    let createdUser: FirebaseUser | null = null;
    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim().toLowerCase();
    const cleanName = name.trim().replace(/\s+/g, " ");
    const emailCheck = validateEmail(cleanEmail);
    const usernameCheck = validateUsername(cleanUsername);
    const nameCheck = validateFullName(cleanName);
    const passwordCheck = validatePassword(pass);

    if (!nameCheck.isValid) return { success: false, error: nameCheck.error };
    if (!emailCheck.isValid) return { success: false, error: emailCheck.error };
    if (!usernameCheck.isValid) return { success: false, error: usernameCheck.error };
    if (!passwordCheck.isValid) return { success: false, error: passwordCheck.errors[0] };

    if (runtimeConfig.dataBackend === "api") {
      try {
        const res = await api.register(cleanEmail, pass, cleanName);
        if (res.success && res.data?.user) {
          const apiUser = res.data.user;
          const updatedUser: User = {
            uid: apiUser.id,
            name: apiUser.full_name || cleanName,
            email: apiUser.email || cleanEmail,
            avatarUri: apiUser.avatar_url || undefined,
            username: cleanUsername,
          };
          setUser(updatedUser);
          await AsyncStorage.setItem("@last_active_user_session", JSON.stringify(updatedUser));
          return { success: true };
        }
        return {
          success: false,
          error: res.error?.message || "Registration failed",
        };
      } catch (err: any) {
        return { success: false, error: err.message || "Failed to register" };
      }
    }

    try {

      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
      createdUser = userCredential.user;
      await updateProfileFirebase(userCredential.user, { displayName: cleanName });

      // The username index is an atomic, create-only reservation. It avoids a
      // public users query (which would expose account data) and prevents races.
      const batch = writeBatch(db);
      batch.set(doc(db, `users/${userCredential.user.uid}`), {
        uid: userCredential.user.uid,
        name: cleanName,
        email: cleanEmail,
        username: cleanUsername,
        emailVerified: false,
        pendingVerification: true,
        authProvider: "password",
        createdAt: Date.now(),
      });
      batch.set(doc(db, `usernames/${cleanUsername}`), {
        uid: userCredential.user.uid,
        createdAt: Date.now(),
      });
      await batch.commit();

      // Send verification link to user's email
      let emailSent = false;
      try {
        await sendEmailVerification(userCredential.user);
        emailSent = true;
      } catch (evErr: any) {
        console.warn("⚠️ Failed to send email verification during registration (non-fatal):", evErr);
      }

      // Sign out immediately so unverified account is never logged into state
      await signOut(auth);
      setUser(null);
      await AsyncStorage.removeItem("@last_active_user_session").catch(() => null);

      isRegisteringRef.current = false;
      return { success: true, emailVerificationSent: emailSent, email: cleanEmail };
    } catch (error: any) {
      if (createdUser) await deleteUser(createdUser).catch(() => null);
      isRegisteringRef.current = false;
      if (error?.code === "permission-denied" || error?.code === "already-exists") {
        return { success: false, error: "This username is already taken. Please choose another one." };
      }
      console.warn("❌ [AuthContext] Registration Error caught:", error);
      return { success: false, error: error.message };
    } finally {
      isRegisteringRef.current = false;
    }
  }, []);

  const loginWithGoogle = useCallback(async () => {
    try {
      if (Platform.OS === "web") {
        const { signInWithPopup, GoogleAuthProvider: FirebaseGoogleAuthProvider } = require("firebase/auth");
        const provider = new FirebaseGoogleAuthProvider();
        provider.addScope("profile");
        provider.addScope("email");
        await signInWithPopup(auth, provider);
        return { success: true };
      }

      // Stage 1: Try Native Google Play Services Sign-In
      const GoogleSignin = getGoogleSigninModule();
      if (GoogleSignin) {
        try {
          await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
          const response = await GoogleSignin.signIn();

          let idToken = (response as any)?.data?.idToken || (response as any)?.idToken;
          if (!idToken && typeof GoogleSignin.getTokens === "function") {
            try {
              const tokens = await GoogleSignin.getTokens();
              idToken = tokens.idToken;
            } catch (tokErr) {
              console.warn("Failed to get Google tokens:", tokErr);
            }
          }

          if (idToken) {
            const credential = GoogleAuthProvider.credential(idToken);
            await signInWithCredential(auth, credential);
            return { success: true };
          }
        } catch (nativeErr: any) {
          console.warn("⚠️ Native Google Sign-In failed, attempting WebBrowser Session:", nativeErr);
        }
      }

      // Stage 2: Try WebBrowser Google OAuth Session
      try {
        const redirectUrl = "whisperledger://oauthredirect";
        const clientId = "1064792050841-amo41uudlpvmuoou362ijcktfe198hdr.apps.googleusercontent.com";
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&response_type=id_token&redirect_uri=${encodeURIComponent(redirectUrl)}&scope=openid%20profile%20email&nonce=${Math.random().toString(36).substring(2)}`;

        const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
        if (result.type === "success" && result.url) {
          const match = result.url.match(/id_token=([^&]+)/);
          if (match && match[1]) {
            const idToken = match[1];
            const credential = GoogleAuthProvider.credential(idToken);
            await signInWithCredential(auth, credential);
            return { success: true };
          }
        }
      } catch (webErr) {
        console.warn("⚠️ WebBrowser Google Auth Session failed:", webErr);
      }

      return { success: false, error: "Google sign-in is not available on this device. Please use email and password." };
    } catch (error: any) {
      console.warn("Google Login Error:", error);
      return { success: false, error: error.message || String(error) };
    }
  }, []);

  const logout = useCallback(async () => {
    if (runtimeConfig.dataBackend === "api") {
      await SecureSession.removeItem(SECURE_KEYS.AUTH_TOKEN);
	  await SecureSession.removeItem(SECURE_KEYS.REFRESH_TOKEN);
      setUser(null);
      setIsLoading(false);
      await AsyncStorage.removeItem("@last_active_user_session").catch(() => null);
      return;
    }

    const GoogleSignin = getGoogleSigninModule();
    isSigningOutRef.current = true;
    let signedOut = false;
    try {
      await signOut(auth);
      if (GoogleSignin) await GoogleSignin.signOut();
      signedOut = true;
    } catch (e) {
      console.error("Logout Error:", e);
    } finally {
      isSigningOutRef.current = false;
      if (signedOut) {
        setUser(null);
        setIsLoading(false);
        AsyncStorage.removeItem("@last_active_user_session").catch(() => null);
      }
    }
  }, []);

  const updateProfile = useCallback(async (updates: Partial<Omit<User, "uid" | "email">>) => {
    if (!user) return;
    
    if (runtimeConfig.dataBackend === "api") {
      const nextUser = { ...user, ...updates };
      setUser((prev) => (prev ? { ...prev, ...updates } : null));
      try {
        const response = await api.updateProfile(updates.name, updates.avatarUri);
        if (!response.success) {
          throw new Error(response.error?.message || "Could not update profile");
        }
        const cachedKey = `@user_profile_${user.uid}`;
        const cached = await AsyncStorage.getItem(cachedKey);
        const currentProfile = cached ? JSON.parse(cached) : {};
        const merged = { ...currentProfile, ...updates };
        await AsyncStorage.setItem(cachedKey, JSON.stringify(merged));
        await AsyncStorage.setItem("@last_active_user_session", JSON.stringify(nextUser));
      } catch (err) {
        console.error("Local storage user save failed:", err);
		setUser(user);
		throw err;
      }
      return;
    }

    setUser((prev) => prev ? { ...prev, ...updates } : null);
    
    if (updates.name && auth.currentUser) {
      await updateProfileFirebase(auth.currentUser, { displayName: updates.name }).catch(() => null);
    }
    
    try {
      const cachedKey = `@user_profile_${user.uid}`;
      const cached = await AsyncStorage.getItem(cachedKey);
      const currentProfile = cached ? JSON.parse(cached) : {};
      await AsyncStorage.setItem(cachedKey, JSON.stringify({ ...currentProfile, ...updates }));
    } catch (err) {
      console.error("Local storage user save failed:", err);
    }

    try {
      await setDoc(doc(db, `users/${user.uid}`), updates, { merge: true });
    } catch (err) {
      console.warn("⚠️ Background user profile Firestore sync failed:", err);
    }
  }, [user]);

  const forgotPassword = useCallback(async (email: string) => {
    try {
      // Firebase Auth owns password reset delivery; no reset requests or email
      // addresses are written to Firestore from the client.
      const actionCodeSettings = {
        url: "https://whisperledger.app/login",
        handleCodeInApp: true,
      };
      await sendPasswordResetEmail(auth, email, actionCodeSettings).catch(async () => {
        // Fallback without actionCodeSettings if domain is not whitelisted yet
        await sendPasswordResetEmail(auth, email);
      });

      return { success: true };
    } catch (error: any) {
      console.error("❌ [AuthContext] Forgot Password Error:", error);
      return { success: false, error: error.message };
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthReady, login, register, loginWithGoogle, logout, updateProfile, forgotPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
