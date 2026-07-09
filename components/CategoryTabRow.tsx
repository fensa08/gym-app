import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native'
import { colors, fonts, fs, r, sp } from '../lib/theme'

export function CategoryTabRow<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: T; label: string }[]
  active: T
  onChange: (key: T) => void
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroll}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => onChange(tab.key)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { marginBottom: sp.md },
  row: { gap: 8, paddingRight: sp.md },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: r.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabActive: { backgroundColor: colors.accentLime, borderColor: colors.accentLime },
  tabText: { color: colors.textSecondary, fontFamily: fonts.sansSemiBold, fontSize: fs.sm },
  tabTextActive: { color: colors.textPrimary },
})
