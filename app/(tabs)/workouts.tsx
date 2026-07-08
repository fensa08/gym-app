import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { useSQLiteContext } from 'expo-sqlite'
import { useState, useCallback } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, sp, r, fs, fonts } from '../../lib/theme'
import { getRecentWorkouts } from '../../lib/db/queries'
import { useWorkoutStore } from '../../lib/store/workout'
import { buildWorkoutFromTemplate } from '../../lib/workoutHelpers'
import { TEMPLATES } from '../../lib/templates'
import type { Workout } from '../../lib/types'

export default function WorkoutsScreen() {
  const db = useSQLiteContext()
  const router = useRouter()
  const [recentWorkouts, setRecentWorkouts] = useState<Workout[]>([])

  useFocusEffect(
    useCallback(() => {
      getRecentWorkouts(db, 30).then(setRecentWorkouts)
    }, [])
  )

  function lastDoneFor(name: string) {
    const w = recentWorkouts.find((r) => r.name === name)
    if (!w) return 'never'
    const days = Math.floor((Date.now() - w.started_at) / 86400000)
    if (days <= 0) return 'today'
    if (days === 1) return 'yesterday'
    if (days < 7) return `${days} days ago`
    return `${Math.floor(days / 7)}w ago`
  }

  async function handleStart(templateIndex: number) {
    const template = TEMPLATES[templateIndex]
    const { workoutId, exercises } = await buildWorkoutFromTemplate(db, template)
    useWorkoutStore.getState().startWorkout(workoutId, template.name, exercises)
    router.push('/workout/active')
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>Train</Text>
        <Text style={styles.title}>Your Programs</Text>

        <View style={styles.list}>
          {TEMPLATES.map((prog, i) => (
            <View key={prog.key} style={styles.card}>
              <View style={[styles.icon, { backgroundColor: prog.iconBg }]}>
                <Ionicons name="barbell-outline" size={20} color={prog.iconColor} />
              </View>
              <View style={styles.info}>
                <Text style={styles.name}>{prog.name}</Text>
                <Text style={styles.meta}>
                  {prog.exercises.length} exercises · ~{prog.duration} min
                </Text>
                <Text style={styles.lastDone}>Last done {lastDoneFor(prog.name)}</Text>
              </View>
              <TouchableOpacity style={styles.startBtn} onPress={() => handleStart(i)} activeOpacity={0.85}>
                <Text style={styles.startBtnText}>Start</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: sp.md, paddingBottom: 120 },
  eyebrow: {
    color: colors.textSecondary,
    fontFamily: fonts.sansSemiBold,
    fontSize: fs.xs,
    letterSpacing: 1.2,
    marginBottom: 6,
    marginTop: sp.xs,
  },
  title: { color: colors.textPrimary, fontFamily: fonts.serif, fontSize: 30, marginBottom: sp.md },
  list: { gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.lg,
    padding: sp.md,
  },
  icon: { width: 44, height: 44, borderRadius: r.md, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, minWidth: 0 },
  name: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: fs.md },
  meta: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fs.sm, marginTop: 2 },
  lastDone: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.xs, marginTop: 2 },
  startBtn: {
    backgroundColor: colors.surfaceGreen,
    borderWidth: 1,
    borderColor: colors.borderMed,
    borderRadius: r.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  startBtnText: { color: colors.accentDark, fontFamily: fonts.sansSemiBold, fontSize: fs.sm },
})
