import { Stack } from 'expo-router'
import { SQLiteProvider } from 'expo-sqlite'
import { StatusBar } from 'expo-status-bar'
import { initDB } from '../lib/db/schema'
import { seedExercises } from '../lib/db/seed'
import type { SQLiteDatabase } from 'expo-sqlite'

async function onInit(db: SQLiteDatabase) {
  await initDB(db)
  await seedExercises(db)
}

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="gym.db" onInit={onInit}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0A0A0F' } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="workout/active"
          options={{
            presentation: 'fullScreenModal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack>
    </SQLiteProvider>
  )
}
