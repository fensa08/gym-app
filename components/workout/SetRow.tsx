import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, sp, r, fs } from '../../lib/theme'
import type { ActiveSet } from '../../lib/types'

interface Props {
  set: ActiveSet
  previous?: { weightKg: number | null; reps: number | null }
  onUpdate(updates: Partial<Pick<ActiveSet, 'weightKg' | 'reps'>>): void
  onComplete(): void
}

export function SetRow({ set, previous, onUpdate, onComplete }: Props) {
  const prevText =
    previous?.weightKg && previous?.reps
      ? `${previous.weightKg}×${previous.reps}`
      : '—'

  return (
    <View style={[styles.row, set.completed && styles.rowCompleted]}>
      <View style={[styles.setNum, set.isPR && styles.setNumPR]}>
        {set.isPR ? (
          <Text style={styles.prIcon}>🏆</Text>
        ) : (
          <Text style={[styles.setNumText]}>{set.setNumber}</Text>
        )}
      </View>

      <Text style={styles.prev}>{prevText}</Text>

      <TextInput
        style={[styles.input, styles.inputWide, set.completed && styles.inputDone]}
        value={set.weightKg}
        onChangeText={(v) => onUpdate({ weightKg: v })}
        keyboardType="decimal-pad"
        placeholder={previous?.weightKg ? String(previous.weightKg) : '0'}
        placeholderTextColor={colors.border}
        editable={!set.completed}
        returnKeyType="done"
        selectTextOnFocus
      />

      <TextInput
        style={[styles.input, styles.inputNarrow, set.completed && styles.inputDone]}
        value={set.reps}
        onChangeText={(v) => onUpdate({ reps: v })}
        keyboardType="number-pad"
        placeholder={previous?.reps ? String(previous.reps) : '0'}
        placeholderTextColor={colors.border}
        editable={!set.completed}
        returnKeyType="done"
        selectTextOnFocus
      />

      <TouchableOpacity
        onPress={!set.completed ? onComplete : undefined}
        style={styles.checkBtn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons
          name={set.completed ? 'checkmark-circle' : 'checkmark-circle-outline'}
          size={30}
          color={set.completed ? colors.success : colors.border}
        />
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sp.sm - 2,
    gap: sp.sm,
    borderRadius: r.sm,
  },
  rowCompleted: {
    opacity: 0.55,
  },
  setNum: {
    width: 28,
    height: 28,
    borderRadius: r.sm,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setNumPR: {
    backgroundColor: colors.accentWarm + '22',
  },
  setNumText: {
    color: colors.textSecondary,
    fontSize: fs.sm,
    fontWeight: '700',
  },
  prIcon: {
    fontSize: 14,
  },
  prev: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: fs.sm,
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    color: colors.textPrimary,
    fontSize: fs.md,
    fontWeight: '600',
    borderRadius: r.sm,
    paddingHorizontal: sp.sm,
    paddingVertical: 7,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputWide: { width: 68 },
  inputNarrow: { width: 52 },
  inputDone: {
    borderColor: colors.success + '50',
    backgroundColor: colors.success + '12',
    color: colors.success,
  },
  checkBtn: {
    width: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
