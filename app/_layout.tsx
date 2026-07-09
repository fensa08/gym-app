import { Stack } from 'expo-router'
import { SQLiteProvider } from 'expo-sqlite'
import { StatusBar } from 'expo-status-bar'
import { View } from 'react-native'
import { useFonts as useCormorant, CormorantGaramond_400Regular, CormorantGaramond_500Medium } from '@expo-google-fonts/cormorant-garamond'
import { useFonts as useInter, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter'
import { useFonts as useJetBrainsMono, JetBrainsMono_400Regular, JetBrainsMono_600SemiBold, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono'
import { initDB } from '../lib/db/schema'
import { seedExercises } from '../lib/db/seed'
import { colors } from '../lib/theme'
import type { SQLiteDatabase } from 'expo-sqlite'

async function onInit(db: SQLiteDatabase) {
  await initDB(db)
  await seedExercises(db)
}

export default function RootLayout() {
  const [cormorantLoaded] = useCormorant({ CormorantGaramond_400Regular, CormorantGaramond_500Medium })
  const [interLoaded] = useInter({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold })
  const [monoLoaded] = useJetBrainsMono({ JetBrainsMono_400Regular, JetBrainsMono_600SemiBold, JetBrainsMono_700Bold })

  const fontsReady = cormorantLoaded && interLoaded && monoLoaded

  if (!fontsReady) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />
  }

  return (
    <SQLiteProvider databaseName="gym.db" onInit={onInit}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="workout/active"
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
          name="nutrition/log"
          options={{
            presentation: 'transparentModal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack>
    </SQLiteProvider>
  )
}
