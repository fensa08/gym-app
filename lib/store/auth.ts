import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { auth, googleProvider } from '../firebase'

const CACHED_USER_KEY = 'auth:lastUser'

// Minimal cached shape: only what the app reads before Firebase's own
// listener resolves and overwrites it with the authoritative User.
type CachedUser = Pick<User, 'uid' | 'email' | 'displayName' | 'photoURL'>

interface AuthStore {
  user: User | null
  loading: boolean
  error: string | null
  // True once Firebase Auth's own session restore has completed, i.e.
  // auth.currentUser is authoritative. `user` can be truthy (from the
  // AsyncStorage cache) before this flips true - Firestore reads that key
  // off auth.currentUser must wait for authReady, not just `user`.
  authReady: boolean
  init(): void
  signIn(): Promise<void>
  signOut(): Promise<void>
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  loading: true,
  error: null,
  authReady: false,

  async init() {
    // Unblock the router immediately with the last-known user so a cold
    // start (including a deep link) doesn't have to wait on the async
    // Firebase listener before the Stack can mount. onAuthStateChanged
    // below still runs and corrects this if it's stale.
    try {
      const cached = await AsyncStorage.getItem(CACHED_USER_KEY)
      if (cached) set({ user: JSON.parse(cached) as User, loading: false })
    } catch {
      // ignore corrupt cache, fall through to the real listener
    }

    onAuthStateChanged(
      auth,
      (user) => {
        set({ user, loading: false, error: null })
        if (user) {
          const cached: CachedUser = { uid: user.uid, email: user.email, displayName: user.displayName, photoURL: user.photoURL }
          AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(cached)).catch(() => {})
        } else {
          AsyncStorage.removeItem(CACHED_USER_KEY).catch(() => {})
        }
      },
      (err) => {
        console.error('Auth state error:', err)
        set({ loading: false, error: err.message })
      }
    )

    // Resolves once the SDK's initial auth state is known, i.e. once
    // auth.currentUser is authoritative (the above listener will already
    // have fired with the real user by then). Firestore reads keyed off
    // auth.currentUser must wait for this, not just the cached `user`.
    await auth.authStateReady()
    set({ authReady: true })
  },

  async signIn() {
    // NOTE: signInWithPopup is web-only; native iOS/Android needs a real
    // native Google Sign-In flow (out of scope for this error-handling pass).
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err) {
      console.error('Sign in error:', err)
      throw err
    }
  },

  async signOut() {
    try {
      await signOut(auth)
    } catch (err) {
      console.error('Sign out error:', err)
      throw err
    }
  },
}))
