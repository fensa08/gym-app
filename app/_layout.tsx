import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { View, ActivityIndicator, AppState } from 'react-native'
import { useEffect } from 'react'
import { useFonts as useCormorant, CormorantGaramond_400Regular, CormorantGaramond_500Medium } from '@expo-google-fonts/cormorant-garamond'
import { useFonts as useInter, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter'
import { useFonts as useJetBrainsMono, JetBrainsMono_400Regular, JetBrainsMono_600SemiBold, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono'
import { colors } from '../lib/theme'
import { useAuthStore } from '../lib/store/auth'
import { seedExercises } from '../lib/firestore/seed'
import { syncHealthKitIfNeeded } from '../lib/healthkitSync'

export default function RootLayout() {
  const [cormorantLoaded] = useCormorant({ CormorantGaramond_400Regular, CormorantGaramond_500Medium })
  const [interLoaded] = useInter({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold })
  const [monoLoaded] = useJetBrainsMono({ JetBrainsMono_400Regular, JetBrainsMono_600SemiBold, JetBrainsMono_700Bold })

  const { user, loading, init } = useAuthStore()
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    init()
  }, [])

  const inAuthGroup = segments[0] === 'login'

  useEffect(() => {
    if (loading) return
    if (!user && !inAuthGroup) {
      router.replace('/login')
    } else if (user && inAuthGroup) {
      seedExercises()
      router.replace('/(tabs)')
    }
  }, [user, loading, segments])

  useEffect(() => {
    if (!user) return
    syncHealthKitIfNeeded()
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncHealthKitIfNeeded()
    })
    return () => sub.remove()
  }, [user])

  const fontsReady = cormorantLoaded && interLoaded && monoLoaded
  const needsRedirect = !loading && ((!user && !inAuthGroup) || (user && inAuthGroup))

  if (!fontsReady || loading || needsRedirect) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accentMid} />
      </View>
    )
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="workout/[id]" />
        <Stack.Screen
          name="workout/start"
          options={{
            presentation: 'fullScreenModal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="workout/active"
          options={{
            presentation: 'fullScreenModal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="workout/create-program"
          options={{
            presentation: 'fullScreenModal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="body/log-weight"
          options={{
            presentation: 'transparentModal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="body/log-composition"
          options={{
            presentation: 'transparentModal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="recovery/log"
          options={{
            presentation: 'transparentModal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="nutrition/food-edit"
          options={{
            presentation: 'transparentModal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="nutrition/add-food"
          options={{
            presentation: 'transparentModal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="nutrition/goals"
          options={{
            presentation: 'transparentModal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="nutrition/export"
          options={{
            presentation: 'transparentModal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack>
    </>
  )
}
