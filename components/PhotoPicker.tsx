import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, fonts, fs, r } from '../lib/theme'

// No native image-picker dependency is installed in this project, so photo
// capture is simulated with a placeholder thumbnail rather than opening the
// real camera/gallery UI.
export function PhotoPicker({
  label,
  uri,
  onChange,
}: {
  label: string
  uri: string | null
  onChange: (uri: string | null) => void
}) {
  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={styles.box}
        activeOpacity={0.8}
        onPress={() => onChange(uri ? null : 'placeholder')}
      >
        {uri ? (
          <>
            <View style={styles.thumb}>
              <Ionicons name="person" size={26} color={colors.textSecondary} />
            </View>
            <TouchableOpacity style={styles.removeBtn} onPress={() => onChange(null)}>
              <Ionicons name="close" size={12} color="#fff" />
            </TouchableOpacity>
          </>
        ) : (
          <Ionicons name="camera-outline" size={22} color={colors.textSecondary} />
        )}
      </TouchableOpacity>
      <Text style={styles.label}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 6, flex: 1 },
  box: {
    width: '100%',
    aspectRatio: 0.75,
    borderRadius: r.md,
    borderWidth: 1.5,
    borderColor: colors.borderMed,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceInput,
  },
  thumb: {
    width: '100%',
    height: '100%',
    borderRadius: r.md,
    backgroundColor: colors.surfaceGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { color: colors.textSecondary, fontFamily: fonts.sansMedium, fontSize: fs.xs },
})
