import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { useState, useEffect } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, sp, r, fs, fonts } from '../../lib/theme'
import { insertBodyCompositionLog, getUserGoals, getLatestBodyComposition } from '../../lib/firestore/queriesHealth'
import { PhotoPicker } from '../../components/PhotoPicker'
import { CIRCUMFERENCE_FIELDS } from './index'
import type { BodyFatMethod, BodyCompositionLog } from '../../lib/types'

const METHODS: { key: BodyFatMethod; label: string }[] = [
  { key: 'manual', label: 'Manual' },
  { key: 'navy', label: 'Navy' },
  { key: 'bioimpedance', label: 'Bioimpedance' },
]

export default function LogCompositionModal() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [bodyFatPct, setBodyFatPct] = useState('')
  const [method, setMethod] = useState<BodyFatMethod>('manual')
  const [neckCm, setNeckCm] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [circ, setCirc] = useState<Record<string, string>>({})
  const [photoFront, setPhotoFront] = useState<string | null>(null)
  const [photoSide, setPhotoSide] = useState<string | null>(null)
  const [photoBack, setPhotoBack] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const [goals, latest] = await Promise.all([getUserGoals(), getLatestBodyComposition()])
      setHeightCm(String(latest?.height_cm ?? goals.height_cm))
    })()
  }, [])

  function updateCirc(key: string, value: string) {
    setCirc((c) => ({ ...c, [key]: value }))
  }

  async function handleSave() {
    await insertBodyCompositionLog({
      body_fat_pct: bodyFatPct ? parseFloat(bodyFatPct) : null,
      method,
      neck_cm: method === 'navy' && neckCm ? parseFloat(neckCm) : null,
      height_cm: method === 'navy' && heightCm ? parseFloat(heightCm) : null,
      chest_cm: circ.chest_cm ? parseFloat(circ.chest_cm) : null,
      waist_cm: circ.waist_cm ? parseFloat(circ.waist_cm) : null,
      hips_cm: circ.hips_cm ? parseFloat(circ.hips_cm) : null,
      arms_cm: circ.arms_cm ? parseFloat(circ.arms_cm) : null,
      thighs_cm: circ.thighs_cm ? parseFloat(circ.thighs_cm) : null,
      calves_cm: circ.calves_cm ? parseFloat(circ.calves_cm) : null,
      photo_front: photoFront,
      photo_side: photoSide,
      photo_back: photoBack,
    })
    router.back()
  }

  return (
    <View style={styles.overlay}>
      <View style={[styles.sheet, { paddingBottom: insets.bottom + sp.md, maxHeight: '88%' }]}>
        <View style={styles.handle} />
        <Text style={styles.title}>Log Measurements</Text>

        <ScrollView showsVerticalScrollIndicator={false} style={{ width: '100%' }}>
          <Text style={styles.sectionLabel}>Body Fat</Text>
          <View style={styles.bfRow}>
            <TextInput
              style={styles.bfInput}
              value={bodyFatPct}
              onChangeText={setBodyFatPct}
              placeholder="0.0"
              placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad"
            />
            <Text style={styles.bfUnit}>%</Text>
          </View>

          <View style={styles.methodRow}>
            {METHODS.map((m) => {
              const active = method === m.key
              return (
                <TouchableOpacity
                  key={m.key}
                  style={[styles.methodPill, active && styles.methodPillActive]}
                  onPress={() => setMethod(m.key)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.methodPillText, active && styles.methodPillTextActive]}>{m.label}</Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {method === 'navy' && (
            <View style={styles.navyRow}>
              <View style={styles.navyField}>
                <Text style={styles.fieldLabel}>Neck (cm)</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={neckCm}
                  onChangeText={setNeckCm}
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.navyField}>
                <Text style={styles.fieldLabel}>Height (cm)</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={heightCm}
                  onChangeText={setHeightCm}
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          )}

          <Text style={[styles.sectionLabel, { marginTop: sp.md }]}>Circumferences</Text>
          <View style={styles.circGrid}>
            {CIRCUMFERENCE_FIELDS.map((f) => (
              <View key={f.key} style={styles.circField}>
                <Text style={styles.fieldLabel}>{f.label} (cm)</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={circ[f.key] ?? ''}
                  onChangeText={(v) => updateCirc(f.key, v)}
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="decimal-pad"
                />
              </View>
            ))}
          </View>

          <Text style={[styles.sectionLabel, { marginTop: sp.md }]}>Progress Photos</Text>
          <View style={styles.photoRow}>
            <PhotoPicker label="Front" uri={photoFront} onChange={setPhotoFront} />
            <PhotoPicker label="Side" uri={photoSide} onChange={setPhotoSide} />
            <PhotoPicker label="Back" uri={photoBack} onChange={setPhotoBack} />
          </View>
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
  bfRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: sp.sm },
  bfInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderMed,
    borderRadius: r.md,
    paddingHorizontal: sp.md,
    paddingVertical: 12,
    color: colors.textPrimary,
    fontFamily: fonts.monoSemiBold,
    fontSize: fs.xl,
  },
  bfUnit: { color: colors.textSecondary, fontFamily: fonts.sansSemiBold, fontSize: fs.lg, marginBottom: 10 },
  methodRow: { flexDirection: 'row', gap: 8, marginBottom: sp.md },
  methodPill: {
    flex: 1,
    borderRadius: r.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 9,
    alignItems: 'center',
  },
  methodPillActive: { backgroundColor: colors.accentLime, borderColor: colors.accentLime },
  methodPillText: { color: colors.textSecondary, fontFamily: fonts.sansSemiBold, fontSize: fs.xs },
  methodPillTextActive: { color: colors.textPrimary },
  navyRow: { flexDirection: 'row', gap: sp.sm, marginBottom: sp.md },
  navyField: { flex: 1 },
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
  circGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.sm },
  circField: { width: '47%' },
  photoRow: { flexDirection: 'row', gap: sp.sm, marginBottom: sp.md },
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
