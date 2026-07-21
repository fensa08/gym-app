import { View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native'
import { useRouter } from 'expo-router'
import { useState, useEffect, useRef } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, sp, r, fs, fonts } from '../../lib/theme'
import { upsertBodyWeightLog, getLatestBodyWeight } from '../../lib/firestore/queriesHealth'

export default function LogWeightModal() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [weight, setWeight] = useState(75)
  const [editing, setEditing] = useState(false)
  const [inputText, setInputText] = useState('')
  const [day, setDay] = useState<'today' | 'yesterday'>('today')
  const [notesOpen, setNotesOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const inputRef = useRef<TextInput>(null)

  useEffect(() => {
    getLatestBodyWeight().then((w) => {
      if (w) setWeight(w.weight_kg)
    })
  }, [])

  function bump(delta: number) {
    setWeight((w) => Math.round((w + delta) * 10) / 10)
  }

  function openEdit() {
    setInputText(weight.toFixed(1))
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function commitEdit() {
    const parsed = parseFloat(inputText.replace(',', '.'))
    if (!isNaN(parsed) && parsed > 20 && parsed < 400) {
      setWeight(Math.round(parsed * 10) / 10)
    }
    setEditing(false)
  }

  async function handleSave() {
    const date = new Date()
    if (day === 'yesterday') date.setDate(date.getDate() - 1)
    await upsertBodyWeightLog(weight, date.toISOString().slice(0, 10), notes.trim() || null)
    router.back()
  }

  return (
    <View style={styles.overlay}>
      <View style={[styles.sheet, { paddingBottom: insets.bottom + sp.md }]}>
        <View style={styles.handle} />
        <Text style={styles.title}>Log Weight</Text>

        <TouchableOpacity style={styles.weightRow} onPress={openEdit} activeOpacity={0.75}>
          {editing ? (
            <TextInput
              ref={inputRef}
              style={styles.weightInput}
              value={inputText}
              onChangeText={setInputText}
              keyboardType="decimal-pad"
              returnKeyType="done"
              onBlur={commitEdit}
              onSubmitEditing={commitEdit}
              selectTextOnFocus
            />
          ) : (
            <Text style={styles.weightValue}>{weight.toFixed(1)}</Text>
          )}
          <Text style={styles.unit}>kg</Text>
        </TouchableOpacity>
        {!editing && <Text style={styles.tapHint}>Tap to type</Text>}

        <View style={styles.stepperRow}>
          <TouchableOpacity style={styles.stepBtn} onPress={() => bump(-1)} activeOpacity={0.8}>
            <Text style={styles.stepBtnText}>−1</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.stepBtn} onPress={() => bump(-0.5)} activeOpacity={0.8}>
            <Text style={styles.stepBtnText}>−0.5</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.stepBtn} onPress={() => bump(0.5)} activeOpacity={0.8}>
            <Text style={styles.stepBtnText}>+0.5</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.stepBtn} onPress={() => bump(1)} activeOpacity={0.8}>
            <Text style={styles.stepBtnText}>+1</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dayToggle}>
          <TouchableOpacity
            style={[styles.dayPill, day === 'today' && styles.dayPillActive]}
            onPress={() => setDay('today')}
          >
            <Text style={[styles.dayPillText, day === 'today' && styles.dayPillTextActive]}>Today</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dayPill, day === 'yesterday' && styles.dayPillActive]}
            onPress={() => setDay('yesterday')}
          >
            <Text style={[styles.dayPillText, day === 'yesterday' && styles.dayPillTextActive]}>Yesterday</Text>
          </TouchableOpacity>
        </View>

        {notesOpen ? (
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add a note…"
            placeholderTextColor={colors.textSecondary}
            multiline
          />
        ) : (
          <TouchableOpacity onPress={() => setNotesOpen(true)}>
            <Text style={styles.notesLink}>+ Add notes</Text>
          </TouchableOpacity>
        )}

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
  weightRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: 4 },
  weightValue: { color: colors.textPrimary, fontFamily: fonts.monoBold, fontSize: 72 },
  weightInput: {
    color: colors.textPrimary, fontFamily: fonts.monoBold, fontSize: 72,
    borderBottomWidth: 2, borderBottomColor: colors.accentLime,
    minWidth: 140, textAlign: 'right', paddingBottom: 0,
  },
  tapHint: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fs.xs, marginBottom: sp.md },
  unit: { color: colors.textSecondary, fontFamily: fonts.sansSemiBold, fontSize: fs.lg, marginBottom: 14 },
  stepperRow: { flexDirection: 'row', gap: sp.sm, marginBottom: sp.md },
  stepBtn: {
    backgroundColor: colors.surfaceInput,
    borderRadius: r.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  stepBtnText: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: fs.md },
  dayToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: r.full,
    padding: 4,
    marginBottom: sp.md,
    width: '100%',
  },
  dayPill: { flex: 1, borderRadius: r.full, paddingVertical: 9, alignItems: 'center' },
  dayPillActive: { backgroundColor: colors.accentLime },
  dayPillText: { color: colors.textSecondary, fontFamily: fonts.sansSemiBold, fontSize: fs.sm },
  dayPillTextActive: { color: colors.textPrimary },
  notesLink: { color: colors.accentMid, fontFamily: fonts.sansSemiBold, fontSize: fs.sm, marginBottom: sp.md },
  notesInput: {
    width: '100%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderMed,
    borderRadius: r.md,
    padding: sp.md,
    color: colors.textPrimary,
    fontFamily: fonts.sans,
    fontSize: fs.sm,
    minHeight: 60,
    marginBottom: sp.md,
  },
  saveBtn: { backgroundColor: colors.accentLime, borderRadius: r.lg, paddingVertical: 16, alignItems: 'center', width: '100%' },
  saveBtnText: { color: colors.textPrimary, fontFamily: fonts.sansBold, fontSize: fs.lg },
})
