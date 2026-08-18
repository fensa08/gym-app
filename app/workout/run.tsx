import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { useState, useEffect, useRef, useMemo } from 'react'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors, sp, r, fs, fonts } from '../../lib/theme'
import { saveRun } from '../../lib/firestore/queriesRunning'
import { errorMessage } from '../../lib/errors'

function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

function formatPace(secondsPerKm: number): string {
  const m = Math.floor(secondsPerKm / 60)
  const s = Math.round(secondsPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function LogRunScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const topInset = Math.max(insets.top, 54)
  const bottomInset = Math.max(insets.bottom, sp.md)

  const [running, setRunning] = useState(false)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [accumulatedMs, setAccumulatedMs] = useState(0)
  const [elapsedS, setElapsedS] = useState(0)
  const [distance, setDistance] = useState('')
  const [heartRate, setHeartRate] = useState('')
  const [saving, setSaving] = useState(false)
  const resumedAt = useRef<number | null>(null)

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      const base = resumedAt.current ?? Date.now()
      setElapsedS(Math.floor((accumulatedMs + (Date.now() - base)) / 1000))
    }, 250)
    return () => clearInterval(id)
  }, [running, accumulatedMs])

  const distanceKm = useMemo(() => {
    const v = parseFloat(distance.replace(',', '.'))
    return Number.isFinite(v) && v > 0 ? v : null
  }, [distance])

  const paceLabel = useMemo(() => {
    if (!distanceKm || elapsedS <= 0) return '—'
    return `${formatPace(elapsedS / distanceKm)} /km`
  }, [distanceKm, elapsedS])

  function handleStart() {
    if (startedAt === null) setStartedAt(Date.now())
    resumedAt.current = Date.now()
    setRunning(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
  }

  function handlePause() {
    if (resumedAt.current !== null) {
      setAccumulatedMs((prev) => prev + (Date.now() - resumedAt.current!))
      resumedAt.current = null
    }
    setRunning(false)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  async function handleFinish() {
    if (running) handlePause()
    if (elapsedS <= 0) {
      Alert.alert('Run too short', 'Start the timer before finishing your run.')
      return
    }
    setSaving(true)
    try {
      const hr = heartRate.trim() ? parseInt(heartRate, 10) : null
      await saveRun(startedAt ?? Date.now(), elapsedS, distanceKm ?? 0, Number.isFinite(hr as number) ? hr : null)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      router.back()
    } catch (err) {
      console.error('Failed to save run:', err)
      Alert.alert('Could not save run', errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  function handleClose() {
    if (elapsedS > 0) {
      Alert.alert('Discard run?', 'Your run in progress will not be saved.', [
        { text: 'Keep going', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => router.back() },
      ])
    } else {
      router.back()
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={16} color={colors.textMuted} />
          </TouchableOpacity>
          <Text style={styles.topLabel}>LOG RUN</Text>
          <View style={{ width: 32 }} />
        </View>

        <View style={styles.timerWrap}>
          <Text style={styles.timerLabel}>Time</Text>
          <Text style={styles.timer}>{formatElapsed(elapsedS)}</Text>
          <TouchableOpacity
            style={[styles.timerBtn, running ? styles.timerBtnPause : styles.timerBtnStart]}
            onPress={running ? handlePause : handleStart}
            activeOpacity={0.85}
          >
            <Ionicons name={running ? 'pause' : 'play'} size={22} color={running ? colors.textPrimary : colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Pace</Text>
            <Text style={styles.statValue}>{paceLabel}</Text>
          </View>
        </View>

        <View style={styles.form}>
          <Text style={styles.fieldLabel}>Distance (km)</Text>
          <TextInput
            style={styles.input}
            value={distance}
            onChangeText={setDistance}
            placeholder="e.g. 5.2"
            placeholderTextColor={colors.textSecondary}
            keyboardType="decimal-pad"
          />

          <Text style={styles.fieldLabel}>Avg. heart rate (bpm)</Text>
          <TextInput
            style={styles.input}
            value={heartRate}
            onChangeText={setHeartRate}
            placeholder="e.g. 152"
            placeholderTextColor={colors.textSecondary}
            keyboardType="number-pad"
          />
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, (elapsedS === 0 || saving) && styles.primaryBtnDisabled]}
          onPress={handleFinish}
          disabled={elapsedS === 0 || saving}
          activeOpacity={0.88}
        >
          <Ionicons name="checkmark" size={16} color={elapsedS === 0 ? colors.textMuted : colors.textPrimary} />
          <Text style={[styles.primaryBtnText, (elapsedS === 0 || saving) && styles.primaryBtnTextDisabled]}>
            {saving ? 'Saving…' : 'Finish Run'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: sp.md },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: sp.lg,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.sansSemiBold,
    fontSize: fs.xs,
    letterSpacing: 0.6,
  },
  timerWrap: { alignItems: 'center', marginTop: sp.md, marginBottom: sp.lg },
  timerLabel: { color: colors.textSecondary, fontFamily: fonts.sansSemiBold, fontSize: fs.xs, letterSpacing: 0.6, marginBottom: sp.xs },
  timer: { color: colors.textPrimary, fontFamily: fonts.mono, fontSize: 64, marginBottom: sp.lg },
  timerBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerBtnStart: { backgroundColor: colors.accentLime },
  timerBtnPause: { backgroundColor: colors.surfaceGreen, borderWidth: 1, borderColor: colors.borderMed },
  statsRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: sp.lg },
  statBox: { alignItems: 'center' },
  statLabel: { color: colors.textSecondary, fontFamily: fonts.sansSemiBold, fontSize: fs.xs, letterSpacing: 0.6, marginBottom: 4 },
  statValue: { color: colors.textPrimary, fontFamily: fonts.monoSemiBold, fontSize: fs.xl },
  form: { gap: sp.sm, marginBottom: sp.lg },
  fieldLabel: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: fs.sm, marginBottom: -sp.xs },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderMed,
    borderRadius: r.md,
    paddingHorizontal: sp.md,
    paddingVertical: 14,
    color: colors.textPrimary,
    fontFamily: fonts.sans,
    fontSize: fs.md,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accentLime,
    borderRadius: r.lg,
    paddingVertical: 17,
    marginTop: 'auto',
  },
  primaryBtnDisabled: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  primaryBtnText: { color: colors.textPrimary, fontFamily: fonts.sansBold, fontSize: fs.md },
  primaryBtnTextDisabled: { color: colors.textMuted },
})
