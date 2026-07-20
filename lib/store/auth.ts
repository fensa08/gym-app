import { create } from 'zustand'
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { auth, googleProvider } from '../firebase'

interface AuthStore {
  user: User | null
  loading: boolean
  init(): void
  signIn(): Promise<void>
  signOut(): Promise<void>
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  loading: true,

  init() {
    onAuthStateChanged(auth, (user) => {
      set({ user, loading: false })
    })
  },

  async signIn() {
    await signInWithPopup(auth, googleProvider)
  },

  async signOut() {
    await signOut(auth)
  },
}))
