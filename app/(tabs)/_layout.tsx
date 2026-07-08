import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../lib/theme'

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

function tabIcon(name: IoniconName, outlineName: IoniconName) {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <Ionicons name={focused ? name : outlineName} size={24} color={color} />
  )
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 84,
          paddingBottom: 28,
          paddingTop: 12,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: tabIcon('home', 'home-outline'),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Library',
          tabBarIcon: tabIcon('barbell', 'barbell-outline'),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          tabBarIcon: tabIcon('trending-up', 'trending-up-outline'),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: tabIcon('person', 'person-outline'),
        }}
      />
    </Tabs>
  )
}
