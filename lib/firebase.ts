import { initializeApp } from "firebase/app";
// @ts-ignore
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseEnvironment = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const firebaseConfig = {
  // Firebase web configuration is public by design. Environment values allow
  // staging/production projects to be switched without source edits.
  apiKey: firebaseEnvironment.apiKey || "AIzaSyDyWPFvO_MDqJbRdMjIv0WUJP4wO93dFnA",
  authDomain: firebaseEnvironment.authDomain || "whisperledger-94715.firebaseapp.com",
  projectId: firebaseEnvironment.projectId || "whisperledger-94715",
  storageBucket: firebaseEnvironment.storageBucket || "whisperledger-94715.firebasestorage.app",
  messagingSenderId: firebaseEnvironment.messagingSenderId || "1064792050841",
  appId: firebaseEnvironment.appId || "1:1064792050841:web:9e30d27d9f6aa2e4fe3c08",
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

export const db = getFirestore(app);
