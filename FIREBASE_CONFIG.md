# Firebase Configuration (habbit-app / gym-app)

Firebase project: **gym-app-c422c**

## Env vars

Add these to `.env` in the target project (Expo apps require the `EXPO_PUBLIC_` prefix to expose vars to client code):

```
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyDMyamUuNkg7LMpjb7xH8hvprhsjL9ns9Q
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=gym-app-c422c.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=gym-app-c422c
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=gym-app-c422c.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=856738042670
EXPO_PUBLIC_FIREBASE_APP_ID=1:856738042670:web:640a346af721da1c7b60bf
```

## Raw config object

```js
const firebaseConfig = {
  apiKey: "AIzaSyDMyamUuNkg7LMpjb7xH8hvprhsjL9ns9Q",
  authDomain: "gym-app-c422c.firebaseapp.com",
  projectId: "gym-app-c422c",
  storageBucket: "gym-app-c422c.firebasestorage.app",
  messagingSenderId: "856738042670",
  appId: "1:856738042670:web:640a346af721da1c7b60bf",
}
```

## Init pattern used in this project (`lib/firebase.ts`)

```ts
import { initializeApp, getApps } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

export const db = getFirestore(app)
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()
```

## Notes

- Services used: Firestore, Auth (Google provider).
- These are client-side (public) Firebase web config values — safe to expose in client bundles, but Firestore/Auth security rules still gate actual access. Don't confuse with a service-account private key, which is NOT included here and should never be shared this way.
- If reusing this same Firebase project across apps, make sure Firestore security rules and Auth authorized domains cover the new app's origin/bundle ID.
