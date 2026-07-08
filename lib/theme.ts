export const colors = {
  bg: '#f6f8ef',
  surface: '#ffffff',
  surfaceGreen: '#eef6e0',
  surfaceElevated: '#eef6e0',
  surfaceMint: '#e9f6ee',
  surfaceInput: '#eef2e6',
  accentLime: '#c6f24d',
  accentDark: '#1e4b3a',
  accentDarker: '#163a2d',
  accentMid: '#3f8f5c',
  textPrimary: '#16241c',
  textMuted: '#4b5a4a',
  textSecondary: '#8b9686',
  border: 'rgba(20,30,20,0.06)',
  borderMed: 'rgba(20,30,20,0.15)',
  tabBar: '#16241c',
  error: '#e0575c',
  // legacy aliases so unchanged components don't crash
  accent: '#c6f24d',
  accentWarm: '#e0575c',
  success: '#3f8f5c',
} as const

export const sp = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const

export const r = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 26,
  full: 9999,
} as const

export const fs = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 22,
  xxl: 28,
  xxxl: 36,
} as const

// Cormorant Garamond = display/serif headings, Inter = body/UI, JetBrains Mono = numbers/stats
export const fonts = {
  serif: 'CormorantGaramond_400Regular',
  serifMedium: 'CormorantGaramond_500Medium',
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemiBold: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',
  mono: 'JetBrainsMono_400Regular',
  monoSemiBold: 'JetBrainsMono_600SemiBold',
  monoBold: 'JetBrainsMono_700Bold',
} as const
