import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useEffect, useState, useRef } from 'react'
import { colors, sp, r, fs } from '../../lib/theme'

interface Props {
  endTime: number
  onComplete(): void
  onSkip(): void
  onAdd30(): void
}

export function RestTimer({ endTime, onComplete, onSkip, onAdd30 }: Props) {
  const [remaining, setRemaining] = useState(
    Math.max(0, Math.ceil((endTime - Date.now()) / 1000))
  )
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const r = Math.max(0, Math.ceil((endTime - Date.now()) / 1000))
      setRemaining(r)
      if (r === 0) {
        if (intervalRef.current) clearInterval(intervalRef.current)
        onComplete()
      }
    }, 200)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [endTime])

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const totalSecs = Math.ceil((endTime - Date.now()) / 1000) + (120 - remaining)
  const total = Math.max(remaining, 120)
  const progress = remaining / total

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.card}>
        <View style={styles.left}>
          <Text style={styles.label}>REST</Text>
          <Text style={styles.time}>
            {mins}:{String(secs).padStart(2, '0')}
          </Text>
        </View>

        <View style={styles.barWrap}>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                { width: `${Math.min(100, progress * 100)}%` as any },
              ]}
            />
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity onPress={onSkip} style={styles.btn}>
            <Text style={styles.btnText}>Skip</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onAdd30} style={[styles.btn, styles.btnAccent]}>
            <Text style={[styles.btnText, { color: colors.accent }]}>+30s</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: sp.md,
    paddingBottom: sp.lg,
  },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: r.lg,
    padding: sp.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  left: {
    width: 64,
  },
  label: {
    color: colors.textSecondary,
    fontSize: fs.xs,
    fontWeight: '700',
    letterSpacing: 1,
  },
  time: {
    color: colors.textPrimary,
    fontSize: fs.xl,
    fontWeight: '800',
  },
  barWrap: {
    flex: 1,
  },
  barTrack: {
    height: 5,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  actions: {
    flexDirection: 'row',
    gap: sp.sm,
  },
  btn: {
    paddingHorizontal: sp.sm,
    paddingVertical: sp.xs + 2,
    borderRadius: r.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnAccent: {
    borderColor: colors.accent + '60',
  },
  btnText: {
    color: colors.textSecondary,
    fontSize: fs.sm,
    fontWeight: '600',
  },
})
