// NOVRA GYM tokens: SAYNOVRA palette (see PLAN.md section 1).

export const colors = {
  ink: '#0A0D14',
  surface: '#12161F',
  surface2: '#1A1F2B',
  line: 'rgba(255,255,255,0.08)',
  lime: '#C8F031',
  limeSoft: 'rgba(200,240,49,0.14)',
  ok: '#2EE59D',
  okSoft: 'rgba(46,229,157,0.14)',
  info: '#4DB8FF',
  infoSoft: 'rgba(77,184,255,0.14)',
  bad: '#FF5A4F',
  badSoft: 'rgba(255,90,79,0.14)',
  text: '#EEF1F6',
  muted: '#7C849B',
} as const;

// With expo-font every weight is its own family.
export const fonts = {
  display: 'SpaceGrotesk_700Bold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
  mono: 'JetBrainsMono_500Medium',
} as const;

export const radius = { sm: 10, md: 16, lg: 22, xl: 28 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;
