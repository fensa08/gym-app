import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { useSQLiteContext } from 'expo-sqlite'
import { useState, useEffect } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, sp, r, fs, fonts } from '../../lib/theme'
import { upsertRecoveryLog, getLatestRecoveryLog } from '../../lib/db/queriesHealth'
import { RPESelector, SorenessGrid } from '../../components/Selectors'
import type { MuscleGroupKey, SorenessLevel } from '../../lib/types'

const EMPTY_SORENESS: Record<MuscleGroupKey, SorenessLevel> = {
  chest: 0,
  back: 0,
  legs: 0,
  shoulders: 0,
  arms: 0,
}

export default function LogRecoveryModal() {
  const router = useRouter()
  const db = useSQLiteContext()
  const insets = useSafeAreaInsets()

  const [sleepHours, setSleepHours] = useState(7.5)
  const [sleepQuality, setSleepQuality] = useState<number | null>(null)
  const [stressLevel, setStressLevel] = useState<number | null>(null)
  const [restingHr, setRestingHr] = useState('')
  const [hrv, setHrv] = useState('')
  const [soreness, setSoreness] = useState<Record<MuscleGroupKey, SorenessLevel>>(EMPTY_SORENESS)

  useEffect(() => {
    getLatestRecoveryLog(db).then((log) => {
      if (!log) return
      if (log.sleep_hours != null) setSleepHours(log.sleep_hours)
      if (log.resting_hr != null) setRestingHr(String(log.resting_hr))
      if (log.hrv != null) setHrv(String(log.hrv))
    })
  }, [])

  function bumpSleep(delta: number) {
    setSleepHours((h) => Math.max(0, Math.min(12, Math.round((h + delta) * 10) / 10)))
  }

  function updateSoreness(key: MuscleGroupKey, level: SorenessLevel) {
    setSoreness((s) => ({ ...s, [key]: level }))
  }

  async function handleSave() {
    await upsertRecoveryLog(db, {
      sleep_hours: sleepHours,
      sleep_quality: sleepQuality,
      stress_level: stressLevel,
      resting_hr: restingHr ? parseInt(restingHr, 10) : null,
      hrv: hrv ? parseInt(hrv, 10) : null,
      soreness_chest: soreness.chest,
      soreness_back: soreness.back,
      soreness_legs: soreness.legs,
      soreness_shoulders: soreness.shoulders,
      soreness_arms: soreness.arms,
    })
    router.back()
  }

  return (
    <View style={styles.overlay}>
      <View style={[styles.sheet, { paddingBottom: insets.bottom + sp.md, maxHeight: '90%' }]}>
        <View style={styles.handle} />
        <Text style={styles.title}>Log Check-In</Text>

        <ScrollView showsVerticalScrollIndicator={false} style={{ width: '100%' }}>
          <Text style={styles.sectionLabel}>Sleep</Text>
          <View style={styles.sleepRow}>
            <TouchableOpacity style={styles.stepBtn} onPress={() => bumpSleep(-0.5)} activeOpacity={0.8}>
              <Text style={styles.stepBtnText}>−0.5</Text>
            </TouchableOpacity>
            <Text style={styles.sleepValue}>{sleepHours.toFixed(1)}h</Text>
            <TouchableOpacity style={styles.stepBtn} onPress={() => bumpSleep(0.5)} activeOpacity={0.8}>
              <Text style={styles.stepBtnText}>+0.5</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionLabel}>Sleep Quality</Text>
          <RPESelector value={sleepQuality} onChange={setSleepQuality} />

          <Text style={[styles.sectionLabel, { marginTop: sp.md }]}>Stress Level</Text>
          <RPESelector value={stressLevel} onChange={setStressLevel} />

          <View style={[styles.numRow, { marginTop: sp.md }]}>
            <View style={styles.numField}>
              <Text style={styles.fieldLabel}>Resting HR (bpm)</Text>
              <TextInput
                style={styles.fieldInput}
                value={restingHr}
                onChangeText={setRestingHr}
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.numField}>
              <Text style={styles.fieldLabel}>HRV (ms)</Text>
              <TextInput
                style={styles.fieldInput}
                value={hrv}
                onChangeText={setHrv}
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
              />
            </View>
          </View>

          <Text style={[styles.sectionLabel, { marginTop: sp.md }]}>Soreness</Text>
          <SorenessGrid value={soreness} onChange={updateSoreness} />
        </ScrollView>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.88}>
          <Text style={styles.saveBtnText}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: r.xl,
    borderTopRightRadius: r.xl,
    padding: sp.md,
    alignItems: 'center',
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderMed, marginBottom: sp.md },
  title: { color: colors.textPrimary, fontFamily: fonts.serif, fontSize: 24, marginBottom: sp.md },
  sectionLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: sp.sm,
  },
  sleepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp.md,
    marginBottom: sp.md,
  },
  sleepValue: { color: colors.textPrimary, fontFamily: fonts.monoBold, fontSize: 40, minWidth: 100, textAlign: 'center' },
  stepBtn: {
    backgroundColor: colors.surfaceInput,
    borderRadius: r.md,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  stepBtnText: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: fs.md },
  numRow: { flexDirection: 'row', gap: sp.sm },
  numField: { flex: 1 },
  fieldLabel: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.xs, marginBottom: 6 },
  fieldInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderMed,
    borderRadius: r.md,
    paddingHorizontal: sp.sm,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontFamily: fonts.monoSemiBold,
    fontSize: fs.md,
  },
  saveBtn: {
    backgroundColor: colors.accentLime,
    borderRadius: r.lg,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
    marginTop: sp.md,
  },
  saveBtnText: { color: colors.textPrimary, fontFamily: fonts.sansBold, fontSize: fs.lg },
})
