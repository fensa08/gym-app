import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Link, Stack } from 'expo-router'
import { colors, fonts } from '../lib/theme'

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View style={styles.container}>
        <Text style={styles.title}>Screen not found</Text>
        <Text style={styles.subtitle}>This link doesn't match anything in the app.</Text>
        <Link href="/(tabs)" asChild>
          <Pressable style={styles.button}>
            <Text style={styles.buttonText}>Go to home</Text>
          </Pressable>
        </Link>
      </View>
    </>
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
    fontSize: 28,
    color: colors.textPrimary,
  },
  subtitle: {
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
  },
  button: {
    marginTop: 16,
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
})
