import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { useState } from 'react'
import { colors, fonts } from '../lib/theme'
import { useAuthStore } from '../lib/store/auth'

export default function LoginScreen() {
  const signIn = useAuthStore((s) => s.signIn)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSignIn() {
    setLoading(true)
    setError(null)
    try {
      await signIn()
    } catch (e: any) {
      console.error('Sign in error:', e?.code, e?.message)
      setError(e?.message ?? 'Sign in failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Habbit</Text>
      <Text style={styles.subtitle}>Track your training</Text>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.button} onPress={handleSignIn} disabled={loading}>
        {loading
          ? <ActivityIndicator color={colors.bg} />
          : <Text style={styles.buttonText}>Continue with Google</Text>
        }
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 48,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: fonts.sans,
    fontSize: 16,
    color: colors.textMuted,
    marginBottom: 32,
  },
  button: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 220,
    alignItems: 'center',
  },
  buttonText: {
    fontFamily: fonts.sansMedium,
    fontSize: 16,
    color: colors.bg,
  },
  error: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: '#ef4444',
    textAlign: 'center',
  },
})
