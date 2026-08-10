# Verify: habbit-app (Expo 54, Firebase)

How to run and drive this app for verification.

## Surfaces
- **Web (fastest, drivable with browser tools):** `npx expo start --port 8081`, open http://localhost:8081. React-native-web works for all screens; expo-camera barcode scanning does NOT work on web (native only).
- **iOS simulator:** the user runs the app in **Expo Go** (not a dev client, despite expo-dev-client in deps). iPhone SE (3rd gen) sim `D76F61BC-69F9-4226-948A-123B82C466D6` has Expo Go installed. Install the SDK-matching Expo Go from the URL in `curl -s https://api.expo.dev/v2/versions | jq '.sdkVersions["54.0.0"].iosClientUrl'` — the tar.gz extracts the .app *contents* directly (no wrapper dir); repackage into a `Foo.app` dir before `simctl install`. Gotcha: Expo Go's first-run dev-menu overlay needs a tap to dismiss and there is no tap tooling on this machine (no cliclick/idb, no assistive access) — prefer web.

## Auth (Google-popup only in UI)
Login is `signInWithPopup` Google — not automatable. Workaround on web:
1. Test account exists: `claude.verify.test@example.com` / `VerifyTest123!` (created 2026-08-10 via identitytoolkit signUp; Firestore data is per-user under `users/{uid}/`, so it's isolated).
2. REST sign-in: `POST https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$EXPO_PUBLIC_FIREBASE_API_KEY` (key in `.env`).
3. Inject the session into the page's IndexedDB `firebaseLocalStorageDb` → store `firebaseLocalStorage`, key `firebase:authUser:<apiKey>:[DEFAULT]`, value = user object with `stsTokenManager: {accessToken: idToken, refreshToken, expirationTime}`. Reload; onAuthStateChanged picks it up.

## Gotchas
- Typed routes: adding a route breaks `tsc` until `.expo/types/router.d.ts` regenerates — run `expo start` briefly.
- `npm install` while Metro runs can corrupt node_modules (expo-asset went missing once); restart Metro after dependency changes.
- Pre-existing `tsc` errors in `lib/db/*` (legacy expo-sqlite code, package not installed) — ignore.
