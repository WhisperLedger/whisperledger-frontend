# WhisperLedger Mobile Application

[![React Native](https://img.shields.io/badge/React_Native-0.74-61DAFB?logo=react)](https://reactnative.dev)
[![Expo](https://img.shields.io/badge/Expo-51.0-000020?logo=expo)](https://expo.dev)
[![Android Native](https://img.shields.io/badge/Android-Kotlin_Bridge-3DDC84?logo=android)](https://developer.android.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript)](https://www.typescriptlang.org)

The official mobile client for **WhisperLedger** — built with React Native, Expo, and native Android Kotlin modules for zero-latency SMS capture and hardware biometric security.

---

## 📱 Core Features & Innovations

1. **Native Android SMS Transaction Hook (`SmsBridgeModule.kt`)**
   - Implements a native Android `BroadcastReceiver` (`android.provider.Telephony.SMS_RECEIVED`).
   - Automatically parses incoming bank debits (SBI, HDFC, ICICI, Axis, Paytm, PhonePe, GPay) the moment they arrive.
   - Discards non-transactional OTP messages locally on-device without telemetry leaks or duplicate notifications.

2. **Hardware Biometric Vault (`BiometricGate.tsx`)**
   - Biometric authentication (Fingerprint, Face Unlock) backed by Android BiometricPrompt and Expo SecureStore.
   - Synchronous ref protection preventing infinite authentication loops upon resume.
   - User-configurable toggle in Settings: when disabled, app opens directly with zero friction.

3. **4 Refined Application Tabs**
   - **Home**: Real-time transaction feed, 3-way outflow tagging (*Personal*, *Household*, *Recoverable*), and quick add drawer.
   - **Analytics**: Net personal consumption versus shared living split analysis and monthly trend charts.
   - **Assistant**: Natural-language financial queries, budget health forecasting, and Money Leak Detective alerts.
   - **Profile**: Household cluster management, invite code sharing, biometric security settings, and app info.

4. **Type-Safe Golang API Client (`lib/api.ts`)**
   - Fully typed client interfacing with `whisperledger-backend`.
   - Automated JWT Bearer token management with fallback to secure local encrypted storage.

---

## 📁 Project Structure

```
whisperledger-frontend/
├── android/
│   ├── app/src/main/java/com/whisperledger/app/
│   │   ├── SmsBroadcastReceiver.kt # Native SMS broadcast interceptor
│   │   ├── SmsBridgeModule.kt      # Kotlin-to-React-Native bridge
│   │   ├── SmsBridgePackage.kt     # React Native package registration
│   │   └── MainActivity.kt
│   └── build.gradle
├── app/                            # Expo Router screen hierarchy
│   ├── (tabs)/                     # 4 Core Tab Screens
│   │   ├── index.tsx               # Home Tab
│   │   ├── analytics.tsx           # Analytics Tab
│   │   ├── assistant.tsx           # AI Assistant Tab
│   │   └── profile.tsx             # Profile & Settings Tab
│   └── _layout.tsx                 # Root layout & navigation stack
├── components/
│   ├── BiometricGate.tsx           # Hardware biometric lock screen
│   ├── ExpenseCard.tsx             # Outflow visualization card
│   └── SettleModal.tsx             # Minimum-cash-flow settlement drawer
├── context/
│   ├── AuthContext.tsx             # Authentication state management
│   └── ExpenseContext.tsx          # Local & remote expense synchronization
├── lib/
│   ├── api.ts                      # Type-safe client for Go backend (/api/v1)
│   └── secureStorage.ts            # Hardware Keychain / Keystore wrapper
├── utils/
│   ├── smsParser.ts                # Client regex bank parsing heuristics
│   └── currency.ts                 # INR and multi-currency formatters
├── app.json                        # Expo application manifest & permissions
└── package.json
```

---

## 🛠 Setup & Local Development

### 1. Prerequisites
- **Node.js 18+** or **Node.js 20+**
- **Android Studio** & Android SDK (API 34+)
- **JDK 17+** (required for Android Gradle builds)

### 2. Installation
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file in the project root:

```env
# Point to local Go backend
# Use 10.0.2.2 for Android Emulator, or your LAN IP (e.g., 192.168.1.50:8080) for physical device
EXPO_PUBLIC_API_URL=http://10.0.2.2:8080/api/v1
```

### 4. Running the Development Server
```bash
npx expo start
```
Press `a` in the terminal to launch on a connected Android device or emulator.

---

## 📦 Building the Production Release APK

To compile a standalone, optimized release APK with all native Kotlin bridges compiled:

```bash
cd android
./gradlew assembleRelease
```

The compiled APK will be output to:
```
android/app/build/outputs/apk/release/app-release.apk
```
A verified build is pre-compiled at `WhisperLedger-v1.0.0-release.apk` (80MB) in the root of this repository.
