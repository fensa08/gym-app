import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { useState, useEffect, useCallback } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors, sp, r, fs, fonts } from '../../lib/theme'
import { getBodyWeightLogs, getRecoveryLogs, getNutritionLogs } from '../../lib/firestore/queriesHealth'
import { getExerciseHistory } from '../../lib/firestore/queries'
import {
  rollingAverageByDate,
  rollingAverageIndexed,
  proteinPerKgSeries,
  groupByPeriod,
  GRANULARITY_OPTIONS,
  type Granularity,
} from '../../lib/statsAggregation'
import { LineChart, BarWithLineChart } from '../../components/Charts'

const METRIC_TITLES: Record<string, string> = {
  bodyweight: 'Bodyweight',
  calories: 'Total Daily Calories',
  'protein-per-kg': 'Protein (g/kg bodyweight)',
  sleep: 'Sleep Duration',
  'resting-hr': 'Resting Heart Rate',
  'progressive-overload': 'Progressive Overload',
}

export default function StatDetailScreen() {
  const { metric, exerciseId, name } = useLocalSearchParams<{ metric: string; exerciseId?: string; name?: string }>()
  const router = useRouter()
  const [granularity, setGranularity] = useState<Granularity>('week')
  const [loading, setLoading] = useState(true)
  const [lineData, setLineData] = useState<{ x: number; y: number }[]>([])
  const [barData, setBarData] = useState<{ value: number; lineValue: number | null }[] | null>(null)

  const days = GRANULARITY_OPTIONS.find((g) => g.key === granularity)!.days

  const load = useCallback(async () => {
    setLoading(true)
    setBarData(null)
    if (metric === 'bodyweight') {
      const logs = await getBodyWeightLogs(days)
      const grouped = groupByPeriod(logs.map((l) => ({ date: l.date, value: l.weight_kg })), granularity)
      setLineData(grouped.map((p) => ({ x: new Date(p.date).getTime(), y: Math.round(p.value * 10) / 10 })))
    } else if (metric === 'calories') {
      const logs = await getNutritionLogs(days)
      const points = logs.filter((l): l is typeof l & { calories: number } => l.calories != null).map((l) => ({ date: l.date, value: l.calories }))
      const grouped = groupByPeriod(points, granularity)
      const rolling = granularity === 'day' ? rollingAverageByDate(grouped, 7) : rollingAverageIndexed(grouped, 3)
      setBarData(grouped.map((p, i) => ({ value: p.value, lineValue: rolling[i]?.value ?? null })))
    } else if (metric === 'protein-per-kg') {
      const [logs, weights] = await Promise.all([getNutritionLogs(days), getBodyWeightLogs(days)])
      const series = proteinPerKgSeries(
        logs.map((l) => ({ date: l.date, protein_g: l.protein_g })),
        weights.map((w) => ({ date: w.date, weight_kg: w.weight_kg }))
      )
      const grouped = groupByPeriod(series.map((p) => ({ date: p.date, value: p.gramsPerKg })), granularity)
      setLineData(grouped.map((p) => ({ x: new Date(p.date).getTime(), y: Math.round(p.value * 100) / 100 })))
    } else if (metric === 'sleep') {
      const logs = await getRecoveryLogs(days)
      const points = logs.filter((l): l is typeof l & { sleep_hours: number } => l.sleep_hours != null).map((l) => ({ date: l.date, value: l.sleep_hours }))
      const grouped = groupByPeriod(points, granularity)
      const rolling = granularity === 'day' ? rollingAverageByDate(grouped, 7) : rollingAverageIndexed(grouped, 3)
      setBarData(grouped.map((p, i) => ({ value: p.value, lineValue: rolling[i]?.value ?? null })))
    } else if (metric === 'resting-hr') {
      const logs = await getRecoveryLogs(days)
      const grouped = groupByPeriod(
        logs.filter((l): l is typeof l & { resting_hr: number } => l.resting_hr != null).map((l) => ({ date: l.date, value: l.resting_hr })),
        granularity
      )
      setLineData(grouped.map((p) => ({ x: new Date(p.date).getTime(), y: Math.round(p.value * 10) / 10 })))
    } else if (metric === 'progressive-overload' && exerciseId) {
      const history = await getExerciseHistory(exerciseId, days)
      const grouped = groupByPeriod(history.map((p) => ({ date: p.date, value: p.estimated1RM })), granularity)
      setLineData(grouped.map((p) => ({ x: new Date(p.date).getTime(), y: Math.round(p.value * 10) / 10 })))
    }
    setLoading(false)
  }, [metric, exerciseId, days, granularity])

  useEffect(() => {
    load()
  }, [load])

  const title = metric === 'progressive-overload' && name ? `${name} — Est. 1RM` : METRIC_TITLES[metric] ?? 'Stat Detail'

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{title}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rangeRow}>
          {GRANULARITY_OPTIONS.map((g) => (
            <TouchableOpacity
              key={g.key}
              style={[styles.rangeBtn, granularity === g.key && styles.rangeBtnOn]}
              onPress={() => setGranularity(g.key)}
            >
              <Text style={[styles.rangeText, granularity === g.key && styles.rangeTextOn]}>{g.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.card}>
          {loading ? (
            <Text style={styles.emptyText}>Loading…</Text>
          ) : barData != null ? (
            barData.length === 0 ? (
              <Text style={styles.emptyText}>No data logged in this range yet</Text>
            ) : (
              <BarWithLineChart data={barData} height={220} width={320} />
            )
          ) : lineData.length < 2 ? (
            <Text style={styles.emptyText}>No data logged in this range yet</Text>
          ) : (
            <LineChart data={lineData} height={220} width={320} />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: sp.md, paddingBottom: sp.sm },
  backBtn: { padding: 4 },
  title: { color: colors.textPrimary, fontFamily: fonts.serif, fontSize: fs.xxl },
  content: { padding: sp.md, paddingBottom: 120 },
  rangeRow: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.full,
    padding: 4,
    marginBottom: sp.md,
  },
  rangeBtn: { borderRadius: r.full, paddingVertical: 9, paddingHorizontal: 14, alignItems: 'center' },
  rangeBtnOn: { backgroundColor: colors.accentLime },
  rangeText: { color: colors.textSecondary, fontFamily: fonts.sansSemiBold, fontSize: fs.sm },
  rangeTextOn: { color: colors.textPrimary },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.lg,
    padding: sp.md,
    alignItems: 'center',
  },
  emptyText: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.sm, textAlign: 'center', paddingVertical: sp.xl },
})
