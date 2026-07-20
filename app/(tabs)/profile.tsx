import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useState, useCallback } from 'react'
import { useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, sp, r, fs, fonts } from '../../lib/theme'
import { getRecentWorkouts, getAllPRs, getWorkoutStreak } from '../../lib/firestore/queries'

const SETTINGS: { label: string; value: string; badge?: boolean }[] = [
  { label: 'Units', value: 'Kilograms (kg)' },
  { label: 'Default Rest Timer', value: '90s' },
  { label: 'Notifications', value: 'On' },
  { label: 'Form Check (Camera)', value: '', badge: true },
  { label: 'Nutrition Tracking', value: '', badge: true },
  { label: 'Activity Monitor', value: '', badge: true },
]

export default function ProfileScreen() {
  const [workoutCount, setWorkoutCount] = useState(0)
  const [prCount, setPrCount] = useState(0)
  const [streak, setStreak] = useState(0)

  useFocusEffect(
    useCallback(() => {
      loadData()
    }, [])
  )

  async function loadData() {
    const [ws, prs, s] = await Promise.all([
      getRecentWorkouts(1000),
      getAllPRs(),
      getWorkoutStreak(),
    ])
    setWorkoutCount(ws.length)
    setPrCount(prs.length)
    setStreak(s)
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          <LinearGradient
            colors={[colors.accentLime, colors.accentDark]}
            style={styles.avatar}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.avatarLetter}>S</Text>
          </LinearGradient>
          <Text style={styles.name}>Stefan</Text>
          <Text style={styles.since}>Member since Jan 2026</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatBox value={String(workoutCount)} label="Workouts" />
          <StatBox value={String(streak)} label="Day Streak" />
          <StatBox value={String(prCount)} label="Total PRs" />
        </View>

        {/* Settings */}
        <Text style={styles.sectionLabel}>Preferences</Text>
        <View style={styles.settingsCard}>
          {SETTINGS.map((s, i) => (
            <View key={s.label} style={[styles.settingRow, i < SETTINGS.length - 1 && styles.settingRowBorder]}>
              <Text style={styles.settingLabel}>{s.label}</Text>
              <View style={styles.settingRight}>
                {s.value ? <Text style={styles.settingValue}>{s.value}</Text> : null}
                {s.badge && (
                  <View style={styles.soonBadge}>
                    <Text style={styles.soonBadgeText}>Soon</Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.signOutBtn} activeOpacity={0.85}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

function StatBox({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: sp.md, paddingBottom: 120 },
  avatarWrap: { alignItems: 'center', gap: 10, marginTop: sp.sm, marginBottom: sp.md },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: fs.xxl },
  name: { color: colors.textPrimary, fontFamily: fonts.serif, fontSize: 26 },
  since: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.sm },
  statsRow: { flexDirection: 'row', gap: sp.sm, marginBottom: sp.lg },
  statBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.md,
    padding: 14,
    alignItems: 'center',
  },
  statValue: { color: colors.textPrimary, fontFamily: fonts.monoSemiBold, fontSize: fs.lg },
  statLabel: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: 10, marginTop: 2 },
  sectionLabel: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: fs.sm, marginBottom: sp.sm },
  settingsCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.lg,
    overflow: 'hidden',
    marginBottom: sp.lg,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.md,
    paddingVertical: 13,
    paddingHorizontal: sp.md,
  },
  settingRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  settingLabel: { flex: 1, color: colors.textPrimary, fontFamily: fonts.sans, fontSize: fs.md },
  settingRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  settingValue: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.sm },
  soonBadge: {
    backgroundColor: colors.border,
    borderRadius: r.full,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  soonBadgeText: {
    color: colors.textSecondary,
    fontFamily: fonts.sansSemiBold,
    fontSize: 9,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  signOutBtn: {
    backgroundColor: 'rgba(224,87,92,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(224,87,92,0.25)',
    borderRadius: r.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutText: { color: colors.error, fontFamily: fonts.sansSemiBold, fontSize: fs.md },
})
