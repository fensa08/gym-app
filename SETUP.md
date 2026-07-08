# Habit App — Mobile Dev Setup Checklist (Expo + React Native)

> Platform: macOS | Target: iOS + Android | Framework: Expo (React Native)

---

## Phase 1 — Core Prerequisites

### 1. Homebrew (macOS package manager)
- [x] Install Homebrew if not already present
  ```bash
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  ```
- [x] Verify: `brew --version` → 6.0.6

---

### 2. Node.js (LTS)
- [x] Install via Homebrew (recommended over direct download)
  ```bash
  brew install node
  ```
- [x] Verify: `node --version` → v20.20.0
- [x] Verify: `npm --version` → 10.8.2

> **Alternative:** Use [nvm](https://github.com/nvm-sh/nvm) if you want to switch Node versions easily:
> ```bash
> brew install nvm
> nvm install --lts
> nvm use --lts
> ```

---

### 3. Watchman (file watcher — required by React Native)
- [x] Install via Homebrew
  ```bash
  brew install watchman
  ```
- [x] Verify: `watchman --version` → 2026.03.30.00

---

### 4. Git
- [x] Verify Git is installed: `git --version` → 2.39.3
- [x] Configure name/email if not set:
  ```bash
  git config --global user.name "Your Name"
  git config --global user.email "your@email.com"
  ```
  → Already set: fensa08 / stefan_apostolovski97@hotmail.com

---

## Phase 2 — Expo Setup

### 5. Expo CLI
- [x] Install Expo CLI globally
  ```bash
  npm install -g expo-cli
  ```
- [x] Verify: `expo --version` → 57.0.6

### 6. Create an Expo Account
- [ ] Sign up at [expo.dev](https://expo.dev)
- [ ] Log in from terminal: `npx expo login` → **run this manually in your terminal**

### 7. Expo Go App (for testing on real device — fastest way to test)
- [ ] Install **Expo Go** on your iPhone from the App Store
- [ ] Make sure your phone and Mac are on the **same Wi-Fi network**

---

## Phase 3 — iOS Simulator (macOS only)

### 8. Xcode
- [x] Install Xcode from the Mac App Store → Xcode 15.4 (Build 15F31d)
- [x] Open Xcode at least once to accept the license agreement
- [x] Install Xcode Command Line Tools:
  ```bash
  xcode-select --install
  ```
- [x] Verify: `xcode-select -p` → `/Applications/Xcode.app/Contents/Developer`

### 9. iOS Simulator
- [x] iOS 17.5 runtime installed and linked
- [x] Devices available: iPhone SE, iPhone 15, 15 Plus, 15 Pro, 15 Pro Max + iPads
- [x] iPhone 15 Pro boots successfully — Phase 3 complete

---

## Phase 4 — Android Emulator (optional but recommended)

### 10. Java Development Kit (JDK)
- [x] Zulu JDK 17.0.19 installed

### 11. Android Studio
- [~] SKIPPED — Android Studio crashes on macOS 14.1 Sonoma (Carbon menu API incompatibility). Revisit later by downloading the latest version from developer.android.com/studio.

### 12. Android Virtual Device (Emulator)
- [~] SKIPPED — depends on Android Studio. Testing on iOS Simulator + Expo Go instead.

---

## Phase 5 — Code Editor

### 13. VS Code (recommended)
- [x] VS Code 3.9.8 installed
- [x] Install these extensions:
  - **ES7+ React/Redux/React-Native snippets** (`dsznajder.es7-react-js-snippets`) → v4.4.3
  - **Prettier - Code formatter** (`esbenp.prettier-vscode`) → v12.4.0
  - **ESLint** (`dbaeumer.vscode-eslint`) → already installed
  - **React Native Tools** (`msjsdiag.vscode-react-native`) → v1.13.0
  - **TypeScript** (built-in, ensure it's enabled)

---

## Phase 6 — Initialize the Project

### 14. Bootstrap the Expo App
- [x] Created with `blank-typescript` template
- [x] Dependencies installed — Expo 57.0.6, React 19.2.3, React Native 0.86.0

### 15. Start the Dev Server
- [ ] Run: `npx expo start`
  - Press `i` → opens iOS Simulator
  - Scan QR code with iPhone camera → opens in Expo Go

---

## Phase 7 — Recommended Libraries for a Habit Tracker

These are solid choices to install once the project is running:

| Purpose | Library |
|---|---|
| Navigation | `expo-router` (file-based) or `react-navigation` |
| Local storage / DB | `expo-sqlite` or `@op-engineering/op-sqlite` |
| State management | `zustand` (lightweight, great for vibecoding) |
| UI components | `react-native-paper` or `nativewind` (Tailwind for RN) |
| Notifications | `expo-notifications` |
| Date handling | `date-fns` |
| Icons | `@expo/vector-icons` (included with Expo) |
| Animations | `react-native-reanimated` |
| Charts / streaks | `react-native-gifted-charts` |

---

## Quick Verification Checklist (run these in order)

```bash
brew --version          # Homebrew installed
node --version          # Node v18+
npm --version           # npm installed
watchman --version      # Watchman installed
expo --version          # Expo CLI installed
xcode-select -p         # Xcode CLI tools path
adb --version           # Android tools (optional)
```

---

## Troubleshooting Tips

- **Metro bundler port conflict:** kill port 8081 with `npx kill-port 8081`
- **Expo Go not connecting:** ensure Mac and phone are on the same Wi-Fi; try tunnel mode `npx expo start --tunnel`
- **Simulator not found:** run `sudo xcode-select -s /Applications/Xcode.app` then retry
- **Android emulator slow:** enable hardware acceleration in Android Studio → Virtual Device settings → enable HAXM

---

*Generated: 2026-07-08 | Stack: Expo SDK 51+ / React Native / TypeScript*
