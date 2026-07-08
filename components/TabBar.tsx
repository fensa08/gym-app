import { View, TouchableOpacity, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { colors, fonts } from '../lib/theme'

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

const ICONS: Record<string, { active: IoniconName; inactive: IoniconName }> = {
  index: { active: 'home', inactive: 'home-outline' },
  workouts: { active: 'barbell', inactive: 'barbell-outline' },
  log: { active: 'checkmark-done-circle', inactive: 'checkmark-done-circle-outline' },
  stats: { active: 'stats-chart', inactive: 'stats-chart-outline' },
  profile: { active: 'person-circle', inactive: 'person-circle-outline' },
}

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.pill}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key]
          const label = String(options.title ?? route.name)
          const isFocused = state.index === index
          const icons = ICONS[route.name] ?? ICONS.index

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            })
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name)
            }
          }

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.75}
              style={[styles.item, isFocused && styles.itemActive]}
            >
              <Ionicons
                name={isFocused ? icons.active : icons.inactive}
                size={20}
                color={isFocused ? colors.accentLime : 'rgba(255,255,255,0.45)'}
              />
              <Text
                style={[
                  styles.label,
                  { color: isFocused ? colors.accentLime : 'rgba(255,255,255,0.45)' },
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 22,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.tabBar,
    borderRadius: 9999,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.3,
    shadowRadius: 36,
    elevation: 12,
  },
  item: {
    alignItems: 'center',
    gap: 3,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 9999,
  },
  itemActive: {
    backgroundColor: 'rgba(198,242,77,0.14)',
  },
  label: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 10,
  },
})
