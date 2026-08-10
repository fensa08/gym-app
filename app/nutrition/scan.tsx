import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, sp, r, fs, fonts } from '../../lib/theme'
import { lookupBarcode, ScannedFood } from '../../lib/openFoodFacts'
import { getFoods } from '../../lib/firestore/queriesHealth'
import type { Food } from '../../lib/types'

type ScanStatus =
  | { kind: 'scanning' }
  | { kind: 'loading' }
  | { kind: 'duplicate'; scanned: ScannedFood; existing: Food }
  | { kind: 'notFound'; barcode: string }
  | { kind: 'error' }

export default function ScanScreen() {
  const router = useRouter()
  const [permission, requestPermission] = useCameraPermissions()
  const [status, setStatus] = useState<ScanStatus>({ kind: 'scanning' })
  const busyRef = useRef(false)

  function openFoodEdit(food: ScannedFood) {
    router.replace({
      pathname: '/nutrition/food-edit',
      params: {
        name: food.name,
        calories: String(food.calories_per_100g),
        protein: String(food.protein_per_100g),
        carbs: String(food.carbs_per_100g),
        fat: String(food.fat_per_100g),
      },
    })
  }

  async function handleBarcode(barcode: string) {
    if (busyRef.current) return
    busyRef.current = true
    setStatus({ kind: 'loading' })
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    try {
      const food = await lookupBarcode(barcode)
      if (!food) {
        setStatus({ kind: 'notFound', barcode })
        return
      }
      const existing = (await getFoods()).find(
        f => f.name.trim().toLowerCase() === food.name.trim().toLowerCase()
      )
      if (existing) {
        setStatus({ kind: 'duplicate', scanned: food, existing })
        return
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      openFoodEdit(food)
    } catch {
      setStatus({ kind: 'error' })
    }
  }

  function resetScanner() {
    busyRef.current = false
    setStatus({ kind: 'scanning' })
  }

  if (!permission) return <View style={styles.safe} />

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header onBack={() => router.back()} />
        <View style={styles.centerFill}>
          <Ionicons name="camera-outline" size={40} color={colors.textSecondary} />
          <Text style={styles.permissionText}>
            Camera access is needed to scan food barcodes.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission} activeOpacity={0.88}>
            <Text style={styles.primaryBtnText}>Grant Camera Access</Text>
          </TouchableOpacity>
          {!permission.canAskAgain && (
            <Text style={styles.permissionHint}>
              Permission was denied. Enable the camera for Gym Tracker in your device settings.
            </Text>
          )}
        </View>
      </SafeAreaView>
    )
  }

  return (
    <View style={styles.cameraWrap}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr'],
        }}
        onBarcodeScanned={status.kind === 'scanning' ? ({ data }) => handleBarcode(data) : undefined}
      />
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        <Header onBack={() => router.back()} light />

        <View style={styles.frameArea}>
          <View style={styles.scanFrame} />
          {status.kind === 'scanning' && (
            <Text style={styles.frameHint}>Point the camera at a product barcode</Text>
          )}
        </View>

        {status.kind !== 'scanning' && (
          <View style={styles.panel}>
            {status.kind === 'loading' && (
              <>
                <ActivityIndicator color={colors.accentDark} />
                <Text style={styles.panelText}>Looking up product…</Text>
              </>
            )}
            {status.kind === 'notFound' && (
              <>
                <Text style={styles.panelTitle}>Product not in database</Text>
                <Text style={styles.panelText}>Barcode {status.barcode} wasn't found on Open Food Facts.</Text>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  activeOpacity={0.88}
                  onPress={() => router.replace('/nutrition/food-edit')}
                >
                  <Text style={styles.primaryBtnText}>Enter Manually</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.88} onPress={resetScanner}>
                  <Text style={styles.secondaryBtnText}>Scan Again</Text>
                </TouchableOpacity>
              </>
            )}
            {status.kind === 'duplicate' && (
              <>
                <Text style={styles.panelTitle}>Already in your library</Text>
                <Text style={styles.panelText}>"{status.existing.name}" already exists.</Text>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  activeOpacity={0.88}
                  onPress={() =>
                    router.replace({ pathname: '/nutrition/food-edit', params: { id: status.existing.id } })
                  }
                >
                  <Text style={styles.primaryBtnText}>Open Existing</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  activeOpacity={0.88}
                  onPress={() => openFoodEdit(status.scanned)}
                >
                  <Text style={styles.secondaryBtnText}>Create Anyway</Text>
                </TouchableOpacity>
              </>
            )}
            {status.kind === 'error' && (
              <>
                <Text style={styles.panelTitle}>Lookup failed</Text>
                <Text style={styles.panelText}>Check your connection and try again.</Text>
                <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.88} onPress={resetScanner}>
                  <Text style={styles.primaryBtnText}>Retry</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </SafeAreaView>
    </View>
  )
}

function Header({ onBack, light }: { onBack: () => void; light?: boolean }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={[styles.backBtn, light && styles.backBtnLight]}>
        <Ionicons name="chevron-back" size={20} color={light ? '#ffffff' : colors.textPrimary} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, light && { color: '#ffffff' }]}>Scan Barcode</Text>
      <View style={styles.backBtn} />
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  cameraWrap: { flex: 1, backgroundColor: '#000000' },
  overlay: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  backBtnLight: { backgroundColor: 'rgba(0,0,0,0.35)' },
  headerTitle: { color: colors.textPrimary, fontFamily: fonts.serif, fontSize: 20 },
  frameArea: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: sp.md },
  scanFrame: {
    width: 240,
    height: 150,
    borderRadius: r.lg,
    borderWidth: 2,
    borderColor: colors.accentLime,
  },
  frameHint: {
    color: '#ffffff',
    fontFamily: fonts.sans,
    fontSize: fs.sm,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: sp.sm,
    paddingVertical: 4,
    borderRadius: r.sm,
    overflow: 'hidden',
  },
  panel: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: r.xl,
    borderTopRightRadius: r.xl,
    padding: sp.md,
    paddingBottom: sp.lg,
    alignItems: 'center',
    gap: sp.sm,
  },
  panelTitle: { color: colors.textPrimary, fontFamily: fonts.serif, fontSize: 20 },
  panelText: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.sm, textAlign: 'center' },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: sp.lg, gap: sp.md },
  permissionText: {
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: fs.md,
    textAlign: 'center',
  },
  permissionHint: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fs.xs, textAlign: 'center' },
  primaryBtn: {
    backgroundColor: colors.accentLime,
    borderRadius: r.lg,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
    marginTop: sp.xs,
  },
  primaryBtnText: { color: colors.textPrimary, fontFamily: fonts.sansBold, fontSize: fs.md },
  secondaryBtn: {
    borderRadius: r.lg,
    borderWidth: 1,
    borderColor: colors.borderMed,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
  },
  secondaryBtnText: { color: colors.textPrimary, fontFamily: fonts.sansBold, fontSize: fs.md },
})
