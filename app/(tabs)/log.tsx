import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  PanResponder,
} from 'react-native'
import { useState, useCallback, useRef } from 'react'
import { useFocusEffect, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { format } from 'date-fns'
import { colors, sp, r, fs, fonts } from '../../lib/theme'
import { getWorkoutHistoryWithStats, deleteWorkout } from '../../lib/firestore/queries'

type Session = Awaited<ReturnType<typeof getWorkoutHistoryWithStats>>[number]

const REVEAL = 76

export default function LogScreen() {
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])

  useFocusEffect(
    useCallback(() => {
      getWorkoutHistoryWithStats(40).then(setSessions)
    }, [])
  )

  async function handleDelete(id: string) {
    setSessions((prev) => prev.filter((s) => s.id !== id))
    try {
      await deleteWorkout(id)
    } catch (_) {}
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>History</Text>
        <Text style={styles.title}>Training Log</Text>

        {sessions.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="checkmark-done-circle-outline" size={40} color={colors.borderMed} />
            <Text style={styles.emptyText}>No workouts logged yet — start your first session!</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {sessions.map((s) => (
              <SwipeableRow key={s.id} onDelete={() => handleDelete(s.id)}>
                <TouchableOpacity
                  style={styles.card}
                  onPress={() => router.push(`/workout/${s.id}`)}
                  activeOpacity={0.82}
                >
                  <View style={styles.icon}>
                    <Ionicons name="checkmark-done" size={20} color={colors.accentDark} />
                  </View>
                  <View style={styles.info}>
                    <Text style={styles.name}>{s.name}</Text>
                    <Text style={styles.meta}>
                      {s.exercise_count} exercises · {s.set_count} sets
                    </Text>
                    <Text style={styles.date}>
                      {s.finished_at ? format(new Date(s.finished_at), 'EEE, MMM d') : ''}
                    </Text>
                  </View>
                  <View style={styles.right}>
                    <View style={styles.volWrap}>
                      <Text style={styles.volume}>{fmtVol(s.volume)}</Text>
                      <Text style={styles.volLabel}>kg volume</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} style={{ marginTop: 4 }} />
                  </View>
                </TouchableOpacity>
              </SwipeableRow>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function SwipeableRow({ children, onDelete }: { children: React.ReactNode; onDelete(): void }) {
  const translateX = useRef(new Animated.Value(0)).current
  const revealed = useRef(false)

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy) * 1.8,
      onPanResponderMove: (_, g) => {
        const base = revealed.current ? REVEAL : 0
        const next = Math.max(0, Math.min(base + g.dx, REVEAL + 12))
        translateX.setValue(next)
      },
      onPanResponderRelease: (_, g) => {
        const base = revealed.current ? REVEAL : 0
        const projected = base + g.dx
        const open = projected > REVEAL / 2
        revealed.current = open
        Animated.spring(translateX, {
          toValue: open ? REVEAL : 0,
          useNativeDriver: true,
          bounciness: 4,
        }).start()
      },
    })
  ).current

  function close() {
    revealed.current = false
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start()
  }

  return (
    <View style={rowStyles.wrap}>
      {/* Delete action — sits behind on the left */}
      <View style={rowStyles.deleteAction}>
        <TouchableOpacity
          style={rowStyles.deleteBtn}
          onPress={() => { close(); onDelete() }}
          activeOpacity={0.85}
        >
          <Ionicons name="trash-outline" size={20} color="#fff" />
          <Text style={rowStyles.deleteBtnText}>Delete</Text>
        </TouchableOpacity>
      </View>

      {/* Row content slides right to reveal the action */}
      <Animated.View style={{ transform: [{ translateX }] }} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  )
}

const rowStyles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    borderRadius: r.lg,
  },
  deleteAction: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: REVEAL,
    backgroundColor: colors.error,
    borderRadius: r.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  deleteBtnText: {
    color: '#fff',
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
  },
})

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
  list: { gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.lg,
    padding: sp.md,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: r.md,
    backgroundColor: colors.surfaceGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, minWidth: 0 },
  name: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: fs.md },
  meta: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fs.sm, marginTop: 2 },
  date: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.xs, marginTop: 2 },
  right: { alignItems: 'flex-end', gap: 2 },
  volWrap: { alignItems: 'flex-end' },
  volume: { color: colors.textPrimary, fontFamily: fonts.monoSemiBold, fontSize: fs.md },
  volLabel: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: 10, marginTop: 1 },
  empty: { alignItems: 'center', gap: sp.md, paddingVertical: sp.xxl },
  emptyText: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.sm, textAlign: 'center' },
})
