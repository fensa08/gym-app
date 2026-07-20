import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { useState, useCallback } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, sp, r, fs, fonts } from '../../lib/theme'
import { SignalCard, StatChip } from '../../components/Cards'
import {
  getBodyCompositionSignal,
  getReadinessSignal,
  getBulkQualitySignal,
  getCalibrationSignal,
  SIGNAL_COLORS,
  type Signal,
} from '../../lib/insights'
import { getStaleExercises, markStalenessResolved } from '../../lib/firestore/queriesHealth'

export default function InsightsScreen() {
  const router = useRouter()
  const [bodyComp, setBodyComp] = useState<Signal | null>(null)
  const [readiness, setReadiness] = useState<Signal | null>(null)
  const [bulkQuality, setBulkQuality] = useState<Signal | null>(null)
  const [calibration, setCalibration] = useState<Signal | null>(null)
  const [staleExercises, setStaleExercises] = useState<
    { exercise_id: string; exercise_name: string; days_since_pr: number }[]
  >([])

  useFocusEffect(
    useCallback(() => {
      loadData()
    }, [])
  )

  async function loadData() {
    const [bc, ready, bq, cal, stale] = await Promise.all([
      getBodyCompositionSignal(),
      getReadinessSignal(),
      getBulkQualitySignal(),
      getCalibrationSignal(),
      getStaleExercises(),
    ])
    setBodyComp(bc)
    setReadiness(ready)
    setBulkQuality(bq)
    setCalibration(cal)
    setStaleExercises(stale)
  }

  async function handleResolve(exerciseId: string) {
    await markStalenessResolved(exerciseId)
    loadData()
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Insights</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {bodyComp && <SignalCardView signal={bodyComp} />}
        {readiness && <SignalCardView signal={readiness} />}
        {bulkQuality && <SignalCardView signal={bulkQuality} />}

        <View style={styles.staleCard}>
          <View style={[styles.accentBar, { backgroundColor: colors.error }]} />
          <View style={styles.staleContent}>
            <Text style={styles.staleTitle}>Exercises Needing Change</Text>
            {staleExercises.length === 0 ? (
              <Text style={styles.emptyText}>All lifts progressing well</Text>
            ) : (
              staleExercises.map((ex) => (
                <View key={ex.exercise_id} style={styles.staleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.staleName}>{ex.exercise_name}</Text>
                    <View style={styles.staleBadge}>
                      <Text style={styles.staleBadgeText}>{ex.days_since_pr}d since PR</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.resolveBtn}
                    onPress={() => handleResolve(ex.exercise_id)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.resolveBtnText}>Mark Resolved</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </View>

        {calibration ? (
          <SignalCardView signal={calibration} />
        ) : (
          <View style={styles.staleCard}>
            <View style={[styles.accentBar, { backgroundColor: colors.border }]} />
            <View style={styles.staleContent}>
              <Text style={styles.staleTitle}>Calorie Calibration</Text>
              <Text style={styles.emptyText}>Log 14 days of nutrition to unlock</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function SignalCardView({ signal }: { signal: Signal }) {
  return (
    <SignalCard
      title={signal.title}
      headline={signal.headline}
      accentColor={SIGNAL_COLORS[signal.color]}
      recommendation={signal.recommendation}
    >
      <View style={styles.chipsRow}>
        {signal.chips.map((chip) => (
          <StatChip key={chip.label} label={chip.label} value={chip.value} />
        ))}
      </View>
    </SignalCard>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sp.md,
    paddingTop: sp.sm,
    paddingBottom: sp.sm,
  },
  backBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: colors.textPrimary, fontFamily: fonts.serif, fontSize: 22 },
  content: { padding: sp.md, paddingTop: 0, paddingBottom: 120 },
  chipsRow: { flexDirection: 'row', gap: 8 },
  staleCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.lg,
    marginBottom: sp.md,
    overflow: 'hidden',
  },
  accentBar: { width: 4 },
  staleContent: { flex: 1, padding: sp.md, gap: 8 },
  staleTitle: {
    color: colors.textSecondary,
    fontFamily: fonts.sansSemiBold,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  emptyText: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fs.sm, paddingVertical: sp.sm },
  staleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  staleName: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: fs.sm },
  staleBadge: {
    backgroundColor: colors.surfaceInput,
    borderRadius: r.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  staleBadgeText: { color: colors.error, fontFamily: fonts.monoSemiBold, fontSize: 10 },
  resolveBtn: {
    borderWidth: 1,
    borderColor: colors.borderMed,
    borderRadius: r.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  resolveBtnText: { color: colors.textSecondary, fontFamily: fonts.sansSemiBold, fontSize: 10 },
})
