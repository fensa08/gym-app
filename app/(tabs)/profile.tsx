import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { useState, useCallback } from 'react'
import { useFocusEffect } from 'expo-router'
import { useSQLiteContext } from 'expo-sqlite'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors, sp, r, fs } from '../../lib/theme'
import { getRecentWorkouts, getAllPRs } from '../../lib/db/queries'

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

const SETTINGS: { label: string; value: string; icon: IoniconName }[] = [
  { label: 'Default Rest Time', value: '2:00', icon: 'timer-outline' },
  { label: 'Weight Unit', value: 'kg', icon: 'scale-outline' },
  { label: 'Theme', value: 'Dark', icon: 'moon-outline' },
  { label: 'Notifications', value: 'On', icon: 'notifications-outline' },
]

export default function ProfileScreen() {
  const db = useSQLiteContext()
  const [workoutCount, setWorkoutCount] = useState(0)
  const [prCount, setPrCount] = useState(0)

  useFocusEffect(
    useCallback(() => {
      loadData()
    }, [])
  )

  async function loadData() {
    const [ws, prs] = await Promise.all([getRecentWorkouts(db, 1000), getAllPRs(db)])
    setWorkoutCount(ws.length)
    setPrCount(prs.length)
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>S</Text>
          </View>
          <Text style={styles.name}>Stefan</Text>
          <Text style={styles.email}>stefan.apostolovski97@gmail.com</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsCard}>
          <StatBox icon="barbell" value={String(workoutCount)} label="Workouts" color={colors.accent} />
          <View style={styles.divider} />
          <StatBox icon="trophy" value={String(prCount)} label="Records" color="#FFB800" />
          <View style={styles.divider} />
          <StatBox icon="flame" value="—" label="Streak" color={colors.accentWarm} />
        </View>

        {/* Settings */}
        <Text style={styles.sectionLabel}>SETTINGS</Text>
        <View style={styles.settingsCard}>
          {SETTINGS.map((s, i) => (
            <TouchableOpacity
              key={s.label}
              style={[
                styles.settingRow,
                i < SETTINGS.length - 1 && styles.settingRowBorder,
              ]}
              activeOpacity={0.7}
            >
              <View style={styles.settingIcon}>
                <Ionicons name={s.icon} size={17} color={colors.accent} />
              </View>
              <Text style={styles.settingLabel}>{s.label}</Text>
              <Text style={styles.settingValue}>{s.value}</Text>
              <Ionicons name="chevron-forward" size={15} color={colors.border} />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.version}>Gym Tracker · v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

function StatBox({
  icon,
  value,
  label,
  color,
}: {
  icon: IoniconName
  value: string
  label: string
  color: string
}) {
  return (
    <View style={styles.statBox}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: sp.md,
    alignItems: 'center',
    paddingBottom: 100,
  },
  avatarWrap: { alignItems: 'center', marginBottom: sp.lg, marginTop: sp.sm },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: sp.md,
  },
  avatarLetter: { color: '#fff', fontSize: 34, fontWeight: '800' },
  name: { color: colors.textPrimary, fontSize: fs.xl, fontWeight: '700' },
  email: { color: colors.textSecondary, fontSize: fs.sm, marginTop: 4 },
  statsCard: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: r.lg,
    padding: sp.md,
    marginBottom: sp.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statBox: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: fs.xl, fontWeight: '800' },
  statLabel: { color: colors.textSecondary, fontSize: fs.xs },
  divider: { width: 1, backgroundColor: colors.border, marginVertical: sp.xs },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: fs.xs,
    fontWeight: '700',
    letterSpacing: 1.2,
    alignSelf: 'flex-start',
    marginBottom: sp.sm,
  },
  settingsCard: {
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: r.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: sp.xl,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.md,
    paddingVertical: sp.md,
    paddingHorizontal: sp.md,
  },
  settingRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  settingIcon: {
    width: 32,
    height: 32,
    borderRadius: r.sm,
    backgroundColor: colors.accent + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingLabel: { flex: 1, color: colors.textPrimary, fontSize: fs.md },
  settingValue: { color: colors.textSecondary, fontSize: fs.sm },
  version: { color: colors.border, fontSize: fs.xs, marginTop: sp.md },
})
