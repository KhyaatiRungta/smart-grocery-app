import { Platform } from 'react-native';

/**
 * Design tokens. Warm "fresh market" editorial: cream paper, leaf green for structure,
 * tomato for the one action that matters on each screen. Text is ink-green, never pure black.
 */
export const colors = {
  paper: '#FAF6EF',
  paperDeep: '#F2EADB',
  surface: '#FFFFFF',
  hairline: '#E7DDCB',
  ink: '#1B2A24',
  inkSoft: '#56645D',
  inkMuted: '#8A958F',
  leaf: '#1E5B3A',
  leafSoft: '#E4EFE6',
  tomato: '#E8643A',
  tomatoSoft: '#FCE6DC',
  apricot: '#F6B26B',
  success: '#2F7D4F',
  warning: '#B7791F',
  danger: '#B3372B',
  dangerSoft: '#F8E1DE',
  onPrimary: '#FFFFFF',
} as const;

export const radius = {
  sm: 10,
  md: 14,
  card: 18,
  pill: 999,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Editorial serif for display, system sans for everything else. */
export const fonts = {
  display: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, "Times New Roman", serif' }) as string,
  body: Platform.select({ ios: undefined, android: undefined, default: 'system-ui, -apple-system, Segoe UI, sans-serif' }) as
    | string
    | undefined,
} as const;

export const type = {
  display: { fontFamily: fonts.display, fontSize: 32, lineHeight: 36, letterSpacing: -0.8, color: colors.ink, fontWeight: '700' as const },
  title: { fontFamily: fonts.display, fontSize: 22, lineHeight: 27, letterSpacing: -0.4, color: colors.ink, fontWeight: '700' as const },
  heading: { fontFamily: fonts.body, fontSize: 17, lineHeight: 22, letterSpacing: -0.2, color: colors.ink, fontWeight: '700' as const },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.ink, fontWeight: '400' as const },
  small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.inkSoft, fontWeight: '400' as const },
  micro: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.inkMuted, fontWeight: '500' as const },
  price: { fontFamily: fonts.body, fontSize: 16, lineHeight: 20, color: colors.ink, fontWeight: '700' as const, fontVariant: ['tabular-nums'] as const },
} as const;

export const shadow = Platform.select({
  ios: { shadowColor: '#1B2A24', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  android: { elevation: 1 },
  default: {},
}) as object;
