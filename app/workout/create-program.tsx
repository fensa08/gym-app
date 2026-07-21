import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors, sp, r, fs, fonts } from '../../lib/theme'
import { saveUserProgram } from '../../lib/firestore/queries'

interface ExerciseRow {
  name: string
  sets: string
}

export default function CreateProgramScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [programName, setProgramName] = useState('')
  const [exercises, setExercises] = useState<ExerciseRow[]>([{ name: '', sets: '3' }])
  const [saving, setSaving] = useState(false)

  function addExercise() {
    setExercises((prev) => [...prev, { name: '', sets: '3' }])
  }

  function updateExercise(index: number, field: keyof ExerciseRow, value: string) {
    setExercises((prev) => prev.map((ex, i) => (i === index ? { ...ex, [field]: value } : ex)))
  }

  function removeExercise(index: number) {
    if (exercises.length === 1) return
    setExercises((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSave() {
    const name = programName.trim()
    if (!name) {
      Alert.alert('Missing name', 'Please enter a program name.')
      return
    }
    const validExercises = exercises
      .map((ex) => ({ name: ex.name.trim(), sets: parseInt(ex.sets) || 3 }))
      .filter((ex) => ex.name.length > 0)
    if (validExercises.length === 0) {
      Alert.alert('No exercises', 'Add at least one exercise.')
      return
    }
    setSaving(true)
    try {
      await saveUserProgram(name, validExercises)
      router.back()
    } catch (_) {
      setSaving(false)
      Alert.alert('Error', 'Could not save program. Try again.')
    }
  }

  const topInset = Math.max(insets.top, 54)
  const bottomInset = Math.max(insets.bottom, sp.md)

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.safe, { paddingTop: topInset, paddingBottom: bottomInset }]}>
        <View style={styles.topRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.closeBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={16} color={colors.textMuted} />
          </TouchableOpacity>
          <Text style={styles.topLabel}>CREATE PROGRAM</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sectionLabel}>PROGRAM NAME</Text>
          <TextInput
            style={styles.nameInput}
            value={programName}
            onChangeText={setProgramName}
            placeholder="e.g. My Full Body A"
            placeholderTextColor={colors.textSecondary}
            returnKeyType="done"
          />

          <Text style={styles.sectionLabel}>EXERCISES</Text>

          {exercises.map((ex, i) => (
            <View key={i} style={styles.exerciseRow}>
              <TextInput
                style={[styles.exNameInput]}
                value={ex.name}
                onChangeText={(v) => updateExercise(i, 'name', v)}
                placeholder={`Exercise ${i + 1}`}
                placeholderTextColor={colors.textSecondary}
                returnKeyType="next"
              />
              <View style={styles.setsWrap}>
                <TextInput
                  style={styles.setsInput}
                  value={ex.sets}
                  onChangeText={(v) => updateExercise(i, 'sets', v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  maxLength={2}
                />
                <Text style={styles.setsLabel}>sets</Text>
              </View>
              {exercises.length > 1 && (
                <TouchableOpacity
                  onPress={() => removeExercise(i)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          ))}

          <TouchableOpacity style={styles.addExBtn} onPress={addExercise} activeOpacity={0.8}>
            <Ionicons name="add" size={16} color={colors.accentDark} />
            <Text style={styles.addExText}>Add Exercise</Text>
          </TouchableOpacity>
        </ScrollView>

        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.88}
        >
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Program'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1, paddingHorizontal: sp.md },
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
  sectionLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.sansSemiBold,
    fontSize: fs.xs,
    letterSpacing: 0.8,
    marginBottom: sp.sm,
    marginTop: sp.md,
  },
  nameInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderMed,
    borderRadius: r.lg,
    paddingHorizontal: sp.md,
    paddingVertical: 14,
    color: colors.textPrimary,
    fontFamily: fonts.sansSemiBold,
    fontSize: fs.md,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  exNameInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.md,
    paddingHorizontal: sp.md,
    paddingVertical: 12,
    color: colors.textPrimary,
    fontFamily: fonts.sans,
    fontSize: fs.sm,
  },
  setsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.md,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  setsInput: {
    color: colors.textPrimary,
    fontFamily: fonts.monoBold,
    fontSize: fs.sm,
    minWidth: 22,
    textAlign: 'center',
  },
  setsLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: fs.xs,
  },
  addExBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceGreen,
    borderWidth: 1,
    borderColor: colors.borderMed,
    borderRadius: r.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 4,
    marginBottom: sp.lg,
  },
  addExText: {
    color: colors.accentDark,
    fontFamily: fonts.sansSemiBold,
    fontSize: fs.sm,
  },
  saveBtn: {
    backgroundColor: colors.accentLime,
    borderRadius: r.lg,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: sp.sm,
  },
  saveBtnText: {
    color: colors.textPrimary,
    fontFamily: fonts.sansBold,
    fontSize: fs.lg,
  },
})
