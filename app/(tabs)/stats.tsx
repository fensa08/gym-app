import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { useState, useCallback } from 'react'
import { useFocusEffect } from 'expo-router'
import { useSQLiteContext } from 'expo-sqlite'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Circle } from 'react-native-svg'
import { format } from 'date-fns'
import { colors, sp, r, fs, fonts } from '../../lib/theme'
import { getWeeklyVolume, getAllPRs, getRecentWorkouts, getMonthlyVolume } from '../../lib/db/queries'

const WEEK_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const BAR_HEIGHT = 100
const RING_R = 30
const RING_CIRC = 2 * Math.PI * RING_R
const MONTHLY_GOAL = 80000

export default function StatsScreen() {
  const db = useSQLiteContext()
  const [range, setRange] = useState<'weekly' | 'monthly'>('weekly')
  const [weeklyBars, setWeeklyBars] = useState<{ day: string; heightPct: number; volume: number }[]>([])
  const [totalWeekVol, setTotalWeekVol] = useState(0)
  const [sessionsThisWeek, setSessionsThisWeek] = useState(0)
  const [monthlyVol, setMonthlyVol] = useState(0)
  const [prs, setPrs] = useState<{ exercise_name: string; weight_kg: number; reps: number; completed_at: number }[]>([])

  useFocusEffect(
    useCallback(() => {
      loadData()
    }, [])
  )

  async function loadData() {
    const [volumeRows, allPrs, recent, monthly] = await Promise.all([
      getWeeklyVolume(db),
      getAllPRs(db),
      getRecentWorkouts(db, 100),
      getMonthlyVolume(db),
    ])
    const today = new Date()
    const monday = new Date(today)
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
    const volumeByDay = new Map(volumeRows.map((v) => [v.day, v.volume]))
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      return d
    })
    const isoDay = (d: Date) => d.toISOString().slice(0, 10)
    const vols = days.map((d) => volumeByDay.get(isoDay(d)) ?? 0)
    const maxVol = Math.max(...vols, 1)
    setWeeklyBars(
      vols.map((v, i) => ({
        day: WEEK_LABELS[i],
        heightPct: v > 0 ? Math.max(8, Math.round((v / maxVol) * 100)) : 4,
        volume: v,
      }))
    )
    setTotalWeekVol(vols.reduce((s, v) => s + v, 0))
    setSessionsThisWeek(vols.filter((v) => v > 0).length)
    setMonthlyVol(monthly)
    setPrs(allPrs)
  }

  const monthlyPct = Math.min(1, monthlyVol / MONTHLY_GOAL)

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>Progress</Text>
        <Text style={styles.title}>Your Stats</Text>

        <View style={styles.toggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, range === 'weekly' && styles.toggleBtnOn]}
            onPress={() => setRange('weekly')}
          >
            <Text style={[styles.toggleText, range === 'weekly' && styles.toggleTextOn]}>Weekly</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, range === 'monthly' && styles.toggleBtnOn]}
            onPress={() => setRange('monthly')}
          >
            <Text style={[styles.toggleText, range === 'monthly' && styles.toggleTextOn]}>Monthly</Text>
          </TouchableOpacity>
        </View>

        {range === 'weekly' ? (
          <>
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>Volume by Day</Text>
              </View>
              <View style={styles.bars}>
                {weeklyBars.map((bar, i) => (
                  <View key={i} style={styles.barCol}>
                    <View style={[styles.barFill, { height: `${bar.heightPct}%` }]} />
                    <Text style={styles.barLabel}>{bar.day}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Total Volume</Text>
                <Text style={styles.summaryValue}>{fmtVol(totalWeekVol)} kg</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Sessions</Text>
                <Text style={styles.summaryValue}>{sessionsThisWeek} of 5</Text>
              </View>
            </View>
          </>
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.ringRow}>
                <View style={styles.ringWrap}>
                  <Svg width={72} height={72} viewBox="0 0 72 72" style={{ transform: [{ rotate: '-90deg' }] }}>
                    <Circle cx={36} cy={36} r={RING_R} fill="none" stroke="rgba(20,30,20,0.08)" strokeWidth={7} />
                    <Circle
                      cx={36}
                      cy={36}
                      r={RING_R}
                      fill="none"
                      stroke={colors.accentMid}
                      strokeWidth={7}
                      strokeLinecap="round"
                      strokeDasharray={`${monthlyPct * RING_CIRC} ${RING_CIRC}`}
                    />
                  </Svg>
                  <Text style={styles.ringLabel}>{Math.round(monthlyPct * 100)}%</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Monthly Volume</Text>
                  <Text style={styles.monthlyVolume}>{fmtVol(monthlyVol)} kg</Text>
                  <Text style={styles.monthlyTrend}>Trending up · goal {fmtVol(MONTHLY_GOAL)} kg</Text>
                </View>
              </View>
            </View>

            <Text style={styles.sectionLabel}>Personal Records</Text>
            <View style={styles.card}>
              {prs.length === 0 ? (
                <Text style={styles.emptyText}>Log workouts to start tracking PRs</Text>
              ) : (
                prs.map((pr, i) => (
                  <View key={pr.exercise_name} style={[styles.prRow, i < prs.length - 1 && styles.prRowBorder]}>
                    <View style={styles.prIcon}>
                      <Text style={{ fontSize: 15 }}>🏆</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.prName}>{pr.exercise_name}</Text>
                      <Text style={styles.prDate}>{format(new Date(pr.completed_at), 'MMM d')}</Text>
                    </View>
                    <Text style={styles.prWeight}>{pr.weight_kg} kg</Text>
                  </View>
                ))
              )}
            </View>
          </>
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
  toggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.full,
    padding: 4,
    marginBottom: sp.md,
  },
  toggleBtn: { flex: 1, borderRadius: r.full, paddingVertical: 9, alignItems: 'center' },
  toggleBtnOn: { backgroundColor: colors.accentLime },
  toggleText: { color: colors.textSecondary, fontFamily: fonts.sansSemiBold, fontSize: fs.sm },
  toggleTextOn: { color: colors.textPrimary },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.lg,
    padding: sp.md,
    marginBottom: sp.md,
  },
  cardTop: { marginBottom: sp.md },
  cardTitle: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: fs.sm },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: BAR_HEIGHT },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 6 },
  barFill: { width: '100%', maxWidth: 26, minHeight: 4, borderRadius: 6, backgroundColor: colors.accentLime },
  barLabel: { color: colors.textSecondary, fontFamily: fonts.sansMedium, fontSize: 10 },
  summaryRow: { flexDirection: 'row', gap: sp.sm },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.lg,
    padding: sp.md,
  },
  summaryLabel: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.xs, marginBottom: 6 },
  summaryValue: { color: colors.textPrimary, fontFamily: fonts.monoSemiBold, fontSize: fs.xl },
  ringRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  ringWrap: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  ringLabel: {
    position: 'absolute',
    color: colors.textPrimary,
    fontFamily: fonts.monoSemiBold,
    fontSize: fs.sm,
  },
  monthlyVolume: { color: colors.textPrimary, fontFamily: fonts.monoSemiBold, fontSize: fs.xxl, marginTop: 4 },
  monthlyTrend: { color: colors.accentMid, fontFamily: fonts.sans, fontSize: fs.sm, marginTop: 2 },
  sectionLabel: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: fs.sm, marginBottom: 10 },
  prRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  prRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  prIcon: {
    width: 34,
    height: 34,
    borderRadius: r.sm,
    backgroundColor: colors.surfaceGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prName: { color: colors.textPrimary, fontFamily: fonts.sansMedium, fontSize: fs.md },
  prDate: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.xs, marginTop: 1 },
  prWeight: { color: colors.textPrimary, fontFamily: fonts.monoSemiBold, fontSize: fs.md },
  emptyText: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.sm, textAlign: 'center', paddingVertical: sp.md },
})
