import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { useState, useCallback } from 'react'
import { useFocusEffect } from 'expo-router'
import { useSQLiteContext } from 'expo-sqlite'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { format } from 'date-fns'
import { colors, sp, r, fs, fonts } from '../../lib/theme'
import { getWorkoutHistoryWithStats } from '../../lib/db/queries'

type Session = Awaited<ReturnType<typeof getWorkoutHistoryWithStats>>[number]

export default function LogScreen() {
  const db = useSQLiteContext()
  const [sessions, setSessions] = useState<Session[]>([])

  useFocusEffect(
    useCallback(() => {
      getWorkoutHistoryWithStats(db, 40).then(setSessions)
    }, [])
  )

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>History</Text>
        <Text style={styles.title}>Training Log</Text>

        {sessions.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="checkmark-done-circle-outline" size={40} color={colors.borderMed} />
            <Text style={styles.emptyText}>No workouts logged yet — start your first session!</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {sessions.map((s) => (
              <View key={s.id} style={styles.card}>
                <View style={styles.icon}>
                  <Ionicons name="checkmark-done" size={20} color={colors.accentDark} />
                </View>
                <View style={styles.info}>
                  <Text style={styles.name}>{s.name}</Text>
                  <Text style={styles.meta}>
                    {s.exercise_count} exercises · {s.set_count} sets
                  </Text>
                  <Text style={styles.date}>
                    {s.finished_at ? format(new Date(s.finished_at), 'EEE, MMM d') : ''}
                  </Text>
                </View>
                <View style={styles.volWrap}>
                  <Text style={styles.volume}>{fmtVol(s.volume)}</Text>
                  <Text style={styles.volLabel}>kg volume</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function fmtVol(v: number) {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`
  return String(Math.round(v))
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
  icon: {
    width: 44,
    height: 44,
    borderRadius: r.md,
    backgroundColor: colors.surfaceGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, minWidth: 0 },
  name: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: fs.md },
  meta: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fs.sm, marginTop: 2 },
  date: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.xs, marginTop: 2 },
  volWrap: { alignItems: 'flex-end' },
  volume: { color: colors.textPrimary, fontFamily: fonts.monoSemiBold, fontSize: fs.md },
  volLabel: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: 10, marginTop: 1 },
  empty: { alignItems: 'center', gap: sp.md, paddingVertical: sp.xxl },
  emptyText: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.sm, textAlign: 'center' },
})
