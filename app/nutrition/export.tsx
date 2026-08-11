import { View, Text, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { colors, sp, r, fs, fonts } from '../../lib/theme'
import { getNutritionLogsRange, getFoods } from '../../lib/firestore/queriesHealth'
import { buildFoodMarkdown } from '../../lib/export/exportFood'

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

const PRESETS: { label: string; days: number }[] = [
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'All time', days: 3650 },
]

export default function ExportFoodModal() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [start, setStart] = useState(iso(new Date(Date.now() - 29 * 86400000)))
  const [end, setEnd] = useState(iso(new Date()))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function applyPreset(days: number) {
    setStart(iso(new Date(Date.now() - (days - 1) * 86400000)))
    setEnd(iso(new Date()))
  }

  const validRange = /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end) && start <= end

  async function handleExport() {
    if (!validRange || busy) return
    setBusy(true)
    setError(null)
    try {
      const [logs, foods] = await Promise.all([
        getNutritionLogsRange(start, end),
        getFoods(),
      ])
      const markdown = buildFoodMarkdown(logs, foods, { start, end })

      const file = new File(Paths.cache, `food-export-${start}-to-${end}.md`)
      if (file.exists) file.delete()
      file.create()
      file.write(markdown)

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'text/markdown', dialogTitle: 'Export Food Log' })
      } else {
        setError('Sharing is not available on this device.')
      }
      router.back()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.overlay}>
      <View style={[styles.sheet, { paddingBottom: insets.bottom + sp.md }]}>
        <View style={styles.handle} />
        <Text style={styles.title}>Export Food Log</Text>
        <Text style={styles.hint}>Generates a Markdown file with your logged meals and food library, ready to share.</Text>

        <View style={styles.presetRow}>
          {PRESETS.map(p => (
            <TouchableOpacity key={p.label} style={styles.presetChip} onPress={() => applyPreset(p.days)}>
              <Text style={styles.presetChipText}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.dateRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Start date</Text>
            <TextInput
              style={styles.input}
              value={start}
              onChangeText={setStart}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>End date</Text>
            <TextInput
              style={styles.input}
              value={end}
              onChangeText={setEnd}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        {!validRange && <Text style={styles.errorText}>Enter a valid range (start must be on or before end).</Text>}
        {error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity
          style={[styles.exportBtn, (!validRange || busy) && styles.exportBtnDisabled]}
          onPress={handleExport}
          activeOpacity={0.88}
          disabled={!validRange || busy}
        >
          {busy ? <ActivityIndicator color={colors.textPrimary} /> : <Text style={styles.exportBtnText}>Export</Text>}
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
  title: { color: colors.textPrimary, fontFamily: fonts.serif, fontSize: 24, marginBottom: 6, alignSelf: 'flex-start' },
  hint: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fs.xs, marginBottom: sp.md, alignSelf: 'flex-start' },
  presetRow: { flexDirection: 'row', gap: sp.sm, width: '100%', marginBottom: sp.md },
  presetChip: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderMed,
    borderRadius: r.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  presetChipText: { color: colors.textPrimary, fontFamily: fonts.sans, fontSize: fs.xs },
  dateRow: { flexDirection: 'row', gap: sp.sm, width: '100%' },
  fieldLabel: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.xs, marginBottom: 6 },
  input: {
    width: '100%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderMed,
    borderRadius: r.md,
    paddingHorizontal: sp.md,
    paddingVertical: 12,
    color: colors.textPrimary,
    fontFamily: fonts.monoSemiBold,
    fontSize: fs.md,
  },
  errorText: { color: '#c0503d', fontFamily: fonts.sans, fontSize: fs.xs, marginTop: sp.sm, alignSelf: 'flex-start' },
  exportBtn: {
    backgroundColor: colors.accentLime,
    borderRadius: r.lg,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
    marginTop: sp.md,
  },
  exportBtnDisabled: { opacity: 0.5 },
  exportBtnText: { color: colors.textPrimary, fontFamily: fonts.sansBold, fontSize: fs.lg },
})
