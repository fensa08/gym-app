import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useState, useEffect, useMemo } from 'react'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import Svg, { Circle } from 'react-native-svg'
import { colors, sp, r, fs, fonts } from '../../lib/theme'
import { useWorkoutStore, type RestLogEntry } from '../../lib/store/workout'
import {
  saveSet,
  finishWorkout as dbFinishWorkout,
  getPersonalRecord,
  deleteWorkout,
  getOrCreateExercise,
  addWorkoutExercise,
  getPreviousSets,
} from '../../lib/firestore/queries'
import { setWorkoutRpe as dbSetWorkoutRpe, setExerciseRpe as dbSetExerciseRpe } from '../../lib/firestore/queries'
import { RPESelector } from '../../components/Selectors'

const REST_PRESETS = [60, 90, 120]
const RING_R = 98
const RING_CIRC = 2 * Math.PI * RING_R

export default function ActiveWorkoutScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const store = useWorkoutStore()
  const {
    workoutId,
    workoutName,
    exercises,
    currentExerciseIndex,
    workoutView,
    restDuration,
    restTimerEnd,
    restLog,
    overallRpe,
    perExerciseRpe,
    setCurrentExercise,
    addExercise,
    addSet,
    startRestTimer,
    stopRestTimer,
    setRestDuration,
    logRest,
    setOverallRpe,
    setExerciseRpe,
    setView,
    finishWorkout: storeFinish,
    reset,
  } = store

  const currentExercise = exercises[currentExerciseIndex]
  const [repsInput, setRepsInput] = useState(currentExercise?.startReps ?? 8)
  const [kgInput, setKgInput] = useState(currentExercise?.startKg ?? 20)
  const [customExerciseName, setCustomExerciseName] = useState('')
  const [prLabel, setPrLabel] = useState<string | null>(null)
  const [showDiscardModal, setShowDiscardModal] = useState(false)

  useEffect(() => {
    if (currentExercise) {
      const last = currentExercise.loggedSets[currentExercise.loggedSets.length - 1]
      setRepsInput(last?.reps ?? currentExercise.startReps)
      setKgInput(last?.kg ?? currentExercise.startKg)
    }
  }, [currentExerciseIndex])

  async function handleSaveSet() {
    if (!currentExercise) return
    const setNumber = currentExercise.loggedSets.length + 1
    let isPR = false
    if (currentExercise.workoutExerciseId) {
      const pr = await getPersonalRecord(currentExercise.exerciseId)
      if (!pr || kgInput > pr.weight_kg) {
        isPR = true
        setPrLabel(currentExercise.name)
        setTimeout(() => setPrLabel(null), 2200)
      }
      await saveSet(workoutId!, currentExercise.workoutExerciseId!, setNumber, kgInput, repsInput, isPR)
    }
    addSet(currentExerciseIndex, { reps: repsInput, kg: kgInput })
  }

  async function handleAddCustomExercise() {
    const name = customExerciseName.trim()
    if (!name) return
    const exercise = await getOrCreateExercise(name)
    const [workoutExerciseId, prevSets] = await Promise.all([
      workoutId
        ? addWorkoutExercise(workoutId!, exercise.id, exercises.length, exercise.name)
        : Promise.resolve(undefined),
      getPreviousSets(exercise.id),
    ])
    addExercise({
      workoutExerciseId,
      exerciseId: exercise.id,
      name,
      muscleGroup: exercise.muscle_group,
      equipment: exercise.equipment,
      target: 'Custom exercise',
      startReps: prevSets[0]?.reps ?? 8,
      startKg: prevSets[0]?.weight_kg ?? 20,
      loggedSets: [],
      previousSets: prevSets,
    })
    setCustomExerciseName('')
    setCurrentExercise(exercises.length)
  }

  function handleFinish() {
    setView('rpe')
  }

  function handleFinishRest(actualSeconds: number) {
    if (actualSeconds > 0 && currentExercise) {
      logRest(currentExerciseIndex, currentExercise.name, restDuration, actualSeconds)
    }
    stopRestTimer()
  }

  async function handleConfirmRpe() {
    try {
      if (workoutId) {
        if (overallRpe != null) await dbSetWorkoutRpe(workoutId!, overallRpe)
        for (const [indexStr, rpe] of Object.entries(perExerciseRpe)) {
          const ex = exercises[Number(indexStr)]
          if (ex?.workoutExerciseId) await dbSetExerciseRpe(workoutId!, ex.workoutExerciseId, rpe)
        }
        await dbFinishWorkout(workoutId!)
      }
    } catch (_) {}
    storeFinish()
  }

  function handleDiscard() {
    setShowDiscardModal(true)
  }

  async function confirmDiscard() {
    setShowDiscardModal(false)
    try {
      if (workoutId) await deleteWorkout(workoutId!)
    } catch (_) {}
    reset()
    router.back()
  }

  function handleDone() {
    reset()
    router.back()
  }

  // SafeAreaView reports unreliable (often zero) top insets inside
  // fullScreenModal presentations, which stranded the close button under
  // the dynamic island. Apply insets manually with a safe minimum instead.
  const topInset = Math.max(insets.top, 54)
  const bottomInset = Math.max(insets.bottom, sp.md)

  return (
    <View style={[styles.safe, { paddingTop: topInset, paddingBottom: bottomInset }]}>
      {prLabel && (
        <View style={[styles.prBanner, { top: topInset + 8 }]}>
          <Ionicons name="trophy" size={15} color={colors.accentDark} />
          <Text style={styles.prText}>New PR — {prLabel}!</Text>
        </View>
      )}

      {workoutView === 'logging' && currentExercise && (
        <LoggingView
          exercise={currentExercise}
          index={currentExerciseIndex}
          total={exercises.length}
          repsInput={repsInput}
          kgInput={kgInput}
          onReps={setRepsInput}
          onKg={setKgInput}
          onSave={handleSaveSet}
          onExit={handleDiscard}
          onOpenPicker={() => setView('picker')}
          onStartRest={() => startRestTimer(restDuration)}
          onFinish={handleFinish}
        />
      )}

      {workoutView === 'picker' && (
        <PickerView
          programName={workoutName}
          exercises={exercises}
          currentIndex={currentExerciseIndex}
          customName={customExerciseName}
          onCustomNameChange={setCustomExerciseName}
          onAddCustom={handleAddCustomExercise}
          onPick={(i) => setCurrentExercise(i)}
          onClose={() => setView('logging')}
        />
      )}

      {workoutView === 'resting' && restTimerEnd != null && (
        <RestingView
          endTime={restTimerEnd}
          restDuration={restDuration}
          nextExerciseName={currentExercise?.name ?? ''}
          onFinishRest={handleFinishRest}
          onSetDuration={setRestDuration}
        />
      )}

      {workoutView === 'rpe' && (
        <RpeView
          exercises={exercises}
          restLog={restLog}
          overallRpe={overallRpe}
          perExerciseRpe={perExerciseRpe}
          onSetOverallRpe={setOverallRpe}
          onSetExerciseRpe={setExerciseRpe}
          onConfirm={handleConfirmRpe}
        />
      )}

      {workoutView === 'summary' && (
        <SummaryView workoutName={workoutName} exercises={exercises} onDone={handleDone} />
      )}

      <Modal visible={showDiscardModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Close Workout?</Text>
            <Text style={styles.modalBody}>
              Are you sure you want to close? Your workout will not be saved.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowDiscardModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>Keep Going</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalDiscardBtn}
                onPress={confirmDiscard}
                activeOpacity={0.8}
              >
                <Text style={styles.modalDiscardText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

// ── Logging screen ──────────────────────────────────────────────
function LoggingView({
  exercise,
  index,
  total,
  repsInput,
  kgInput,
  onReps,
  onKg,
  onSave,
  onExit,
  onOpenPicker,
  onStartRest,
  onFinish,
}: {
  exercise: NonNullable<ReturnType<typeof useWorkoutStore.getState>['exercises']>[number]
  index: number
  total: number
  repsInput: number
  kgInput: number
  onReps(v: number): void
  onKg(v: number): void
  onSave(): void
  onExit(): void
  onOpenPicker(): void
  onStartRest(): void
  onFinish(): void
}) {
  return (
    <View style={styles.screen}>
      <View style={styles.topRow}>
        <RoundIconBtn icon="close" onPress={onExit} />
        <Text style={styles.topLabel}>
          EXERCISE {index + 1} OF {total}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.exerciseHead}>
        <Text style={styles.exerciseName}>{exercise.name}</Text>
        <Text style={styles.exerciseTarget}>{exercise.target}</Text>
      </View>

      {exercise.previousSets.length > 0 && (
        <View style={styles.prevCard}>
          <Text style={styles.prevLabel}>LAST SESSION</Text>
          <View style={styles.prevRow}>
            {exercise.previousSets.map((s, i) => (
              <View key={i} style={styles.prevChip}>
                <Text style={styles.prevChipText}>
                  {s.reps ?? '—'}×{s.weight_kg != null ? s.weight_kg : '—'}kg
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.stepperGroup}>
        <Stepper label="Reps" value={repsInput} onChange={onReps} min={0} step={1} width={60} />
        <Stepper label="Kg" value={kgInput} onChange={onKg} min={0} step={0.5} width={70} decimal editable />
      </View>

      {exercise.loggedSets.length > 0 && (
        <View style={styles.chipsWrap}>
          {exercise.loggedSets.map((set, i) => (
            <View key={i} style={styles.setChip}>
              <Text style={styles.setChipText}>
                Set {i + 1}: {set.reps}×{set.kg}kg
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={{ flex: 1 }} />

      <View style={styles.actionsCol}>
        <TouchableOpacity style={styles.primaryBtn} onPress={onSave} activeOpacity={0.88}>
          <Text style={styles.primaryBtnText}>Save Set</Text>
        </TouchableOpacity>
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.ghostBtn} onPress={onStartRest} activeOpacity={0.85}>
            <Ionicons name="time-outline" size={15} color={colors.accentDark} />
            <Text style={styles.ghostBtnText}>Rest</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.darkBtn} onPress={onOpenPicker} activeOpacity={0.85}>
            <Text style={styles.darkBtnText}>New Exercise</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={onFinish} style={styles.finishLink}>
          <Text style={styles.finishLinkText}>Finish Workout</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

function Stepper({
  label,
  value,
  onChange,
  min,
  step,
  width,
  decimal,
  editable,
}: {
  label: string
  value: number
  onChange(v: number): void
  min: number
  step: number
  width: number
  decimal?: boolean
  editable?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const display = decimal ? (Math.round(value * 10) / 10).toString() : String(value)

  function commitDraft() {
    const parsed = parseFloat(draft.replace(',', '.'))
    if (!isNaN(parsed) && parsed >= min) {
      onChange(Math.round(parsed * 10) / 10)
    }
    setEditing(false)
  }

  return (
    <View style={styles.stepperCard}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperRow}>
        <TouchableOpacity
          style={styles.stepBtn}
          onPress={() => onChange(Math.max(min, Math.round((value - step) * 10) / 10))}
        >
          <Text style={styles.stepBtnText}>–</Text>
        </TouchableOpacity>

        {editable && editing ? (
          <TextInput
            style={[styles.stepperValue, styles.stepperInput, { minWidth: width }]}
            value={draft}
            onChangeText={setDraft}
            keyboardType="decimal-pad"
            autoFocus
            selectTextOnFocus
            returnKeyType="done"
            onSubmitEditing={commitDraft}
            onBlur={commitDraft}
          />
        ) : (
          <TouchableOpacity
            onPress={() => {
              if (editable) {
                setDraft(display)
                setEditing(true)
              }
            }}
            activeOpacity={editable ? 0.6 : 1}
          >
            <Text style={[styles.stepperValue, { minWidth: width }, editable && styles.stepperValueEditable]}>
              {display}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.stepBtn} onPress={() => onChange(Math.round((value + step) * 10) / 10)}>
          <Text style={styles.stepBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ── Picker screen ────────────────────────────────────────────────
function PickerView({
  programName,
  exercises,
  currentIndex,
  customName,
  onCustomNameChange,
  onAddCustom,
  onPick,
  onClose,
}: {
  programName: string
  exercises: ReturnType<typeof useWorkoutStore.getState>['exercises']
  currentIndex: number
  customName: string
  onCustomNameChange(v: string): void
  onAddCustom(): void
  onPick(i: number): void
  onClose(): void
}) {
  return (
    <View style={styles.screen}>
      <View style={styles.topRow}>
        <RoundIconBtn icon="close" onPress={onClose} />
        <Text style={styles.topLabel}>CHOOSE EXERCISE</Text>
        <View style={{ width: 32 }} />
      </View>

      <Text style={styles.pickerTitle}>{programName}</Text>

      <View style={styles.customRow}>
        <TextInput
          style={styles.customInput}
          value={customName}
          onChangeText={onCustomNameChange}
          placeholder="Add a custom exercise…"
          placeholderTextColor={colors.textSecondary}
          returnKeyType="done"
          onSubmitEditing={onAddCustom}
        />
        <TouchableOpacity style={styles.addBtn} onPress={onAddCustom} activeOpacity={0.85}>
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {exercises.map((ex, i) => {
          const isCurrent = i === currentIndex
          const count = ex.loggedSets.length
          return (
            <TouchableOpacity
              key={i}
              style={[styles.pickRow, isCurrent && styles.pickRowActive]}
              onPress={() => onPick(i)}
              activeOpacity={0.85}
            >
              <View style={[styles.pickDot, { backgroundColor: count > 0 ? colors.accentMid : colors.borderMed }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.pickName}>{ex.name}</Text>
                <Text style={styles.pickTarget}>{ex.target}</Text>
              </View>
              <Text style={styles.pickSetsLabel}>
                {count > 0 ? `${count} set${count > 1 ? 's' : ''} logged` : 'Not started'}
              </Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
    </View>
  )
}

// ── Resting screen ───────────────────────────────────────────────
function RestingView({
  endTime,
  restDuration,
  nextExerciseName,
  onFinishRest,
  onSetDuration,
}: {
  endTime: number
  restDuration: number
  nextExerciseName: string
  onFinishRest(actualSeconds: number): void
  onSetDuration(seconds: number): void
}) {
  const [remaining, setRemaining] = useState(Math.max(0, Math.ceil((endTime - Date.now()) / 1000)))
  const [usingCustom, setUsingCustom] = useState(!REST_PRESETS.includes(restDuration))
  const [customValue, setCustomValue] = useState(restDuration)

  useEffect(() => {
    const id = setInterval(() => {
      const r = Math.max(0, Math.ceil((endTime - Date.now()) / 1000))
      setRemaining(r)
      if (r === 0) {
        clearInterval(id)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        onFinishRest(restDuration)
      }
    }, 200)
    return () => clearInterval(id)
  }, [endTime])

  function handleSkip() {
    onFinishRest(Math.max(0, restDuration - remaining))
  }

  const pct = restDuration > 0 ? remaining / restDuration : 0
  const mm = Math.floor(remaining / 60)
  const ss = remaining % 60
  const label = `${mm}:${ss < 10 ? '0' : ''}${ss}`

  function selectPreset(sec: number) {
    setUsingCustom(false)
    onSetDuration(sec)
  }

  function selectCustom() {
    setUsingCustom(true)
    onSetDuration(customValue)
  }

  function bumpCustom(delta: number) {
    const v = Math.max(15, Math.min(600, customValue + delta))
    setCustomValue(v)
    if (usingCustom) onSetDuration(v)
  }

  return (
    <View style={[styles.screen, { alignItems: 'center' }]}>
      <View style={styles.topRow}>
        <RoundIconBtn icon="close" onPress={handleSkip} />
        <Text style={styles.topLabel}>RESTING</Text>
        <View style={{ width: 32 }} />
      </View>

      <Text style={styles.upNextLabel}>Up next</Text>
      <Text style={styles.upNextName}>{nextExerciseName}</Text>

      <View style={styles.ringWrap}>
        <Svg width={220} height={220} viewBox="0 0 220 220" style={{ transform: [{ rotate: '-90deg' }] }}>
          <Circle cx={110} cy={110} r={RING_R} fill="none" stroke="rgba(20,30,20,0.08)" strokeWidth={10} />
          <Circle
            cx={110}
            cy={110}
            r={RING_R}
            fill="none"
            stroke={colors.accentDark}
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={`${pct * RING_CIRC} ${RING_CIRC}`}
          />
        </Svg>
        <Text style={styles.ringTime}>{label}</Text>
      </View>

      <View style={styles.presetRow}>
        {REST_PRESETS.map((sec) => {
          const active = !usingCustom && restDuration === sec
          return (
            <TouchableOpacity
              key={sec}
              style={[styles.presetChip, active && styles.presetChipActive]}
              onPress={() => selectPreset(sec)}
            >
              <Text style={[styles.presetChipText, active && styles.presetChipTextActive]}>
                {sec === 60 ? '1:00' : sec === 90 ? '1:30' : '2:00'}
              </Text>
            </TouchableOpacity>
          )
        })}
        <TouchableOpacity
          style={[styles.presetChip, usingCustom && styles.presetChipActive]}
          onPress={selectCustom}
        >
          <Text style={[styles.presetChipText, usingCustom && styles.presetChipTextActive]}>Custom</Text>
        </TouchableOpacity>
      </View>

      {usingCustom && (
        <View style={styles.customRestRow}>
          <TouchableOpacity style={styles.stepBtnSm} onPress={() => bumpCustom(-15)}>
            <Text style={styles.stepBtnText}>–</Text>
          </TouchableOpacity>
          <Text style={styles.customRestLabel}>Custom: {customValue}s</Text>
          <TouchableOpacity style={styles.stepBtnSm} onPress={() => bumpCustom(15)}>
            <Text style={styles.stepBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ flex: 1 }} />
      <TouchableOpacity style={styles.skipRestBtn} onPress={handleSkip} activeOpacity={0.88}>
        <Text style={styles.skipRestBtnText}>Skip Rest</Text>
      </TouchableOpacity>
    </View>
  )
}

// ── RPE / rest summary screen ─────────────────────────────────────
function RpeView({
  exercises,
  restLog,
  overallRpe,
  perExerciseRpe,
  onSetOverallRpe,
  onSetExerciseRpe,
  onConfirm,
}: {
  exercises: ReturnType<typeof useWorkoutStore.getState>['exercises']
  restLog: RestLogEntry[]
  overallRpe: number | null
  perExerciseRpe: Record<number, number>
  onSetOverallRpe(rpe: number): void
  onSetExerciseRpe(exerciseIndex: number, rpe: number): void
  onConfirm(): void
}) {
  const [perExerciseOpen, setPerExerciseOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const ratedExercises = useMemo(
    () =>
      exercises
        .map((ex, index) => ({ ...ex, index }))
        .filter((ex) => ex.loggedSets.length > 0),
    [exercises]
  )

  const restSummary = useMemo(() => {
    const byExercise = new Map<number, { exerciseName: string; target: number; actuals: number[] }>()
    for (const entry of restLog) {
      const existing = byExercise.get(entry.exerciseIndex)
      if (existing) {
        existing.actuals.push(entry.actual)
      } else {
        byExercise.set(entry.exerciseIndex, {
          exerciseName: entry.exerciseName,
          target: entry.target,
          actuals: [entry.actual],
        })
      }
    }
    return Array.from(byExercise.values()).map((v) => ({
      exerciseName: v.exerciseName,
      target: v.target,
      actualAvg: Math.round(v.actuals.reduce((s, a) => s + a, 0) / v.actuals.length),
    }))
  }, [restLog])

  async function handleConfirm() {
    setSaving(true)
    await onConfirm()
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topRow}>
        <View style={{ width: 32 }} />
        <Text style={styles.topLabel}>SESSION RATING</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.rpeHeadline}>How hard was this session?</Text>
        <View style={styles.rpeSelectorWrap}>
          <RPESelector value={overallRpe} onChange={onSetOverallRpe} />
        </View>

        {ratedExercises.length > 0 && (
          <View style={styles.rpeCollapseSection}>
            <TouchableOpacity
              style={styles.rpeCollapseHeader}
              onPress={() => setPerExerciseOpen((v) => !v)}
              activeOpacity={0.85}
            >
              <Text style={styles.rpeCollapseTitle}>Per-Exercise RPE</Text>
              <Text style={styles.rpeCollapseSub}>Optional — rate each exercise</Text>
              <Ionicons
                name={perExerciseOpen ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
            {perExerciseOpen && (
              <View style={{ gap: 18, marginTop: sp.sm }}>
                {ratedExercises.map((ex) => (
                  <View key={ex.index}>
                    <Text style={styles.rpeExerciseName}>{ex.name}</Text>
                    <RPESelector
                      value={perExerciseRpe[ex.index] ?? null}
                      onChange={(v) => onSetExerciseRpe(ex.index, v)}
                    />
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {restSummary.length > 0 && (
          <View style={styles.rpeTableCard}>
            <Text style={styles.rpeTableTitle}>Rest Time Summary</Text>
            <View style={styles.rpeTableHeaderRow}>
              <Text style={[styles.rpeTableHeaderText, { flex: 1.4 }]}>Exercise</Text>
              <Text style={styles.rpeTableHeaderText}>Target</Text>
              <Text style={styles.rpeTableHeaderText}>Actual</Text>
            </View>
            {restSummary.map((row, i) => {
              const withinTarget = Math.abs(row.actualAvg - row.target) <= 15
              return (
                <View
                  key={i}
                  style={[styles.rpeTableRow, i < restSummary.length - 1 && styles.rpeTableRowBorder]}
                >
                  <Text style={[styles.rpeTableCell, { flex: 1.4 }]}>{row.exerciseName}</Text>
                  <Text style={styles.rpeTableCell}>{fmtSeconds(row.target)}</Text>
                  <Text
                    style={[
                      styles.rpeTableCell,
                      { color: withinTarget ? colors.accentMid : '#c98a2e', fontFamily: fonts.monoSemiBold },
                    ]}
                  >
                    {fmtSeconds(row.actualAvg)}
                  </Text>
                </View>
              )
            })}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.primaryBtn, saving && { opacity: 0.6 }]}
        onPress={handleConfirm}
        disabled={saving}
        activeOpacity={0.88}
      >
        <Text style={styles.primaryBtnText}>{saving ? 'Saving…' : 'Confirm & Save'}</Text>
      </TouchableOpacity>
    </View>
  )
}

function fmtSeconds(total: number) {
  const mm = Math.floor(total / 60)
  const ss = total % 60
  return `${mm}:${ss < 10 ? '0' : ''}${ss}`
}

// ── Summary screen ───────────────────────────────────────────────
function SummaryView({
  workoutName,
  exercises,
  onDone,
}: {
  workoutName: string
  exercises: ReturnType<typeof useWorkoutStore.getState>['exercises']
  onDone(): void
}) {
  const summaryExercises = useMemo(() => exercises.filter((e) => e.loggedSets.length > 0), [exercises])
  const totalSets = summaryExercises.reduce((s, e) => s + e.loggedSets.length, 0)
  const totalVolume = summaryExercises.reduce(
    (s, e) => s + e.loggedSets.reduce((s2, set) => s2 + set.reps * set.kg, 0),
    0
  )

  return (
    <View style={styles.screen}>
      <View style={styles.summaryHead}>
        <View style={styles.summaryCheck}>
          <Ionicons name="checkmark" size={26} color={colors.accentMid} />
        </View>
        <Text style={styles.summaryTitle}>Workout Complete</Text>
        <Text style={styles.summarySub}>{workoutName}</Text>
      </View>

      <View style={styles.summaryStatsRow}>
        <SummaryStat value={String(summaryExercises.length)} label="Exercises" />
        <SummaryStat value={String(totalSets)} label="Sets" />
        <SummaryStat value={String(Math.round(totalVolume))} label="Kg Volume" />
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {summaryExercises.map((ex, i) => (
          <View key={i} style={styles.summaryExCard}>
            <Text style={styles.summaryExName}>{ex.name}</Text>
            <View style={styles.chipsWrap}>
              {ex.loggedSets.map((set, si) => (
                <View key={si} style={styles.setChip}>
                  <Text style={styles.setChipText}>
                    {set.reps}×{set.kg}kg
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.primaryBtn} onPress={onDone} activeOpacity={0.88}>
        <Text style={styles.primaryBtnText}>Done</Text>
      </TouchableOpacity>
    </View>
  )
}

function SummaryStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.summaryStatCard}>
      <Text style={styles.summaryStatValue}>{value}</Text>
      <Text style={styles.summaryStatLabel}>{label}</Text>
    </View>
  )
}

function RoundIconBtn({
  icon,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name']
  onPress(): void
}) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.roundBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Ionicons name={icon} size={16} color={colors.textMuted} />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  screen: { flex: 1, padding: sp.md, paddingTop: sp.sm },
  prBanner: {
    position: 'absolute',
    top: 8,
    left: sp.md,
    right: sp.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.surfaceGreen,
    borderRadius: r.md,
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm,
    zIndex: 10,
    borderWidth: 1,
    borderColor: colors.borderMed,
  },
  prText: { color: colors.accentDark, fontFamily: fonts.sansBold, fontSize: fs.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  roundBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topLabel: { color: colors.textSecondary, fontFamily: fonts.sansSemiBold, fontSize: fs.xs, letterSpacing: 0.6 },
  exerciseHead: { alignItems: 'center', marginVertical: 18 },
  exerciseName: { color: colors.textPrimary, fontFamily: fonts.serif, fontSize: 28, textAlign: 'center' },
  exerciseTarget: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.sm, marginTop: 4 },
  stepperGroup: { gap: 14, flex: 1, justifyContent: 'center' },
  stepperCard: {
    backgroundColor: colors.surface,
    borderRadius: r.xl,
    padding: sp.md,
    alignItems: 'center',
    gap: 10,
  },
  stepperLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.sansSemiBold,
    fontSize: fs.xs,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceInput,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnSm: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surfaceInput,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { color: colors.textPrimary, fontSize: 20 },
  stepperValue: {
    color: colors.textPrimary,
    fontFamily: fonts.monoBold,
    fontSize: 40,
    textAlign: 'center',
  },
  stepperValueEditable: {
    borderBottomWidth: 1.5,
    borderBottomColor: colors.borderMed,
  },
  stepperInput: {
    color: colors.textPrimary,
    fontFamily: fonts.monoBold,
    fontSize: 40,
    textAlign: 'center',
    padding: 0,
  },
  prevCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.md,
    paddingHorizontal: sp.md,
    paddingVertical: 10,
    marginBottom: sp.sm,
  },
  prevLabel: {
    color: colors.textMuted,
    fontFamily: fonts.sansSemiBold,
    fontSize: 10,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  prevRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  prevChip: {
    backgroundColor: colors.surfaceInput,
    borderRadius: r.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  prevChipText: { color: colors.textSecondary, fontFamily: fonts.mono, fontSize: fs.xs },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 14 },
  setChip: {
    backgroundColor: colors.surfaceGreen,
    borderWidth: 1,
    borderColor: colors.borderMed,
    borderRadius: r.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  setChipText: { color: colors.accentDark, fontFamily: fonts.mono, fontSize: fs.xs },
  actionsCol: { gap: 10 },
  primaryBtn: {
    backgroundColor: colors.accentLime,
    borderRadius: r.lg,
    paddingVertical: 17,
    alignItems: 'center',
  },
  primaryBtnText: { color: colors.textPrimary, fontFamily: fonts.sansBold, fontSize: fs.lg },
  actionsRow: { flexDirection: 'row', gap: 10 },
  ghostBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(30,75,58,0.08)',
    borderWidth: 1,
    borderColor: colors.borderMed,
    borderRadius: r.lg,
    paddingVertical: 15,
  },
  ghostBtnText: { color: colors.accentDark, fontFamily: fonts.sansSemiBold, fontSize: fs.sm },
  darkBtn: {
    flex: 1,
    backgroundColor: colors.textPrimary,
    borderRadius: r.lg,
    paddingVertical: 15,
    alignItems: 'center',
  },
  darkBtnText: { color: '#fff', fontFamily: fonts.sansSemiBold, fontSize: fs.sm },
  skipRestBtn: {
    alignSelf: 'center',
    backgroundColor: colors.textPrimary,
    borderRadius: r.full,
    paddingHorizontal: 22,
    paddingVertical: 10,
    marginBottom: 4,
  },
  skipRestBtnText: { color: '#fff', fontFamily: fonts.sansSemiBold, fontSize: fs.xs },
  finishLink: { alignItems: 'center', paddingVertical: 6 },
  finishLinkText: {
    color: colors.textSecondary,
    fontFamily: fonts.sansSemiBold,
    fontSize: fs.sm,
    textDecorationLine: 'underline',
  },
  pickerTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.serif,
    fontSize: 24,
    textAlign: 'center',
    marginVertical: 14,
  },
  customRow: { flexDirection: 'row', gap: 8, marginBottom: sp.md },
  customInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderMed,
    borderRadius: r.md,
    paddingHorizontal: sp.md,
    paddingVertical: 12,
    color: colors.textPrimary,
    fontFamily: fonts.sans,
    fontSize: fs.sm,
  },
  addBtn: {
    backgroundColor: colors.textPrimary,
    borderRadius: r.md,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  addBtnText: { color: '#fff', fontFamily: fonts.sansSemiBold, fontSize: fs.sm },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.lg,
    padding: 14,
    marginBottom: 10,
  },
  pickRowActive: { backgroundColor: colors.surfaceGreen, borderColor: colors.borderMed },
  pickDot: { width: 8, height: 8, borderRadius: 4 },
  pickName: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: fs.md },
  pickTarget: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.xs, marginTop: 2 },
  pickSetsLabel: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fs.xs },
  upNextLabel: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.md, marginTop: 10 },
  upNextName: { color: colors.textPrimary, fontFamily: fonts.serif, fontSize: 24, marginBottom: 24 },
  ringWrap: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center' },
  ringTime: {
    position: 'absolute',
    color: colors.textPrimary,
    fontFamily: fonts.monoBold,
    fontSize: 52,
  },
  presetRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 28 },
  presetChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: r.full,
    borderWidth: 1,
    borderColor: colors.borderMed,
  },
  presetChipActive: { backgroundColor: 'rgba(30,75,58,0.1)', borderColor: colors.accentDark },
  presetChipText: { color: colors.textSecondary, fontFamily: fonts.sansSemiBold, fontSize: fs.sm },
  presetChipTextActive: { color: colors.accentDark },
  customRestRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 16 },
  customRestLabel: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.sm, minWidth: 90, textAlign: 'center' },
  summaryHead: { alignItems: 'center', marginBottom: 18 },
  summaryCheck: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  summaryTitle: { color: colors.textPrimary, fontFamily: fonts.serif, fontSize: 28 },
  summarySub: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.sm, marginTop: 4 },
  summaryStatsRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  summaryStatCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: r.lg,
    padding: 14,
    alignItems: 'center',
  },
  summaryStatValue: { color: colors.textPrimary, fontFamily: fonts.monoSemiBold, fontSize: fs.lg },
  summaryStatLabel: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: 10, marginTop: 2 },
  summaryExCard: { backgroundColor: colors.surface, borderRadius: r.lg, padding: 14, marginBottom: 10 },
  summaryExName: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: fs.md, marginBottom: 8 },
  rpeHeadline: {
    color: colors.textPrimary,
    fontFamily: fonts.serif,
    fontSize: 24,
    textAlign: 'center',
    marginTop: 14,
    marginBottom: 18,
  },
  rpeSelectorWrap: { marginBottom: 20 },
  rpeCollapseSection: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.lg,
    padding: sp.md,
    marginBottom: sp.md,
  },
  rpeCollapseHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rpeCollapseTitle: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: fs.sm },
  rpeCollapseSub: { flex: 1, color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.xs },
  rpeExerciseName: { color: colors.textPrimary, fontFamily: fonts.sansMedium, fontSize: fs.sm, marginBottom: 8 },
  rpeTableCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.lg,
    padding: sp.md,
    marginBottom: sp.md,
  },
  rpeTableTitle: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: fs.sm, marginBottom: 10 },
  rpeTableHeaderRow: { flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  rpeTableHeaderText: {
    flex: 1,
    color: colors.textSecondary,
    fontFamily: fonts.sansSemiBold,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  rpeTableRow: { flexDirection: 'row', paddingVertical: 12 },
  rpeTableRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rpeTableCell: { flex: 1, color: colors.textPrimary, fontFamily: fonts.sans, fontSize: fs.sm },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: sp.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: r.xl,
    padding: sp.lg,
    width: '100%',
    gap: sp.md,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.sansBold,
    fontSize: fs.lg,
    textAlign: 'center',
  },
  modalBody: {
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: fs.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: sp.sm },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: colors.surfaceInput,
    borderRadius: r.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCancelText: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: fs.sm },
  modalDiscardBtn: {
    flex: 1,
    backgroundColor: colors.error,
    borderRadius: r.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalDiscardText: { color: '#fff', fontFamily: fonts.sansBold, fontSize: fs.sm },
})
