/**
 * OGAM-owned design tokens restored from MIT-licensed repository history
 * (`efc85a70`, prior to `@offgrid/design` workspace extraction) plus the `ALIVE`
 * motion parameters required by `AliveProvider` and `LivingField`.
 */

export const COLORS_LIGHT = {
  // Primary accent
  primary: '#059669',
  primaryDark: '#047857',
  primaryLight: '#34D399',
  /** Text and icons on a filled emerald surface: near-black keeps AA contrast in both themes. */
  onPrimary: '#0A0A0A',
  // The main action: a deeper emerald, so white text passes 4.5:1.
  heroFill: '#047857',
  heroBorder: '#065F46',
  onHero: '#FFFFFF',

  // Backgrounds
  background: '#FFFFFF',
  surface: '#F5F5F5',
  // A surface the living field shows through; on the white background it reads as `surface` (#F5F5F5).
  surfaceGlass: 'rgba(0,0,0,0.04)',
  surfaceLight: '#EBEBEB',
  surfaceHover: '#E0E0E0',

  // Text hierarchy
  text: '#0A0A0A',
  textSecondary: '#525252',
  textMuted: '#8A8A8A',
  textDisabled: '#BFBFBF',

  // Borders
  border: '#E5E5E5',
  borderLight: '#D4D4D4',
  borderFocus: '#059669',

  // Semantic colors
  success: '#525252',
  warning: '#0A0A0A',
  error: '#DC2626',
  trending: '#D97706',
  errorBackground: 'rgba(220, 38, 38, 0.10)',
  info: '#525252',

  // Special
  overlay: 'rgba(0, 0, 0, 0.4)',
  divider: '#EBEBEB',
};

export type ThemeColors = typeof COLORS_LIGHT;

export const COLORS_DARK: ThemeColors = {
  // Primary accent
  primary: '#34D399',
  primaryDark: '#10B981',
  primaryLight: '#6EE7B7',
  onPrimary: '#0A0A0A',
  // The main action, as desktop's candy accent button: emerald blended into the page, light text.
  heroFill: '#217B5A',
  heroBorder: 'rgba(52,211,153,0.55)',
  onHero: '#F2FFF8',

  // Backgrounds
  background: '#0A0A0A',
  surface: '#141414',
  // A surface the living field shows through; on a plain background it reads as `surface`.
  surfaceGlass: 'rgba(255,255,255,0.04)',
  surfaceLight: '#1E1E1E',
  surfaceHover: '#252525',

  // Text hierarchy
  text: '#FFFFFF',
  textSecondary: '#B0B0B0',
  textMuted: '#808080',
  textDisabled: '#4A4A4A',

  // Borders
  border: '#1E1E1E',
  borderLight: '#2A2A2A',
  borderFocus: '#34D399',

  // Semantic colors
  success: '#B0B0B0',
  warning: '#FFFFFF',
  error: '#C75050',
  trending: '#F59E0B',
  errorBackground: 'rgba(239, 68, 68, 0.15)',
  info: '#B0B0B0',

  // Special
  overlay: 'rgba(0, 0, 0, 0.7)',
  divider: '#1A1A1A',
};

export const FONTS = {
  sans: 'Geist',
  mono: 'Geist Mono',
};

export const TYPOGRAPHY = {
  // Display / Hero numbers
  display: {
    fontSize: 22,
    fontFamily: FONTS.mono,
    fontWeight: '200' as const,
    letterSpacing: -0.5,
  },

  // Headings
  h1: {
    fontSize: 24,
    fontFamily: FONTS.sans,
    fontWeight: '300' as const,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 16,
    fontFamily: FONTS.sans,
    fontWeight: '400' as const,
    letterSpacing: -0.2,
  },
  h3: {
    fontSize: 13,
    fontFamily: FONTS.sans,
    fontWeight: '400' as const,
    letterSpacing: -0.2,
  },

  // Body text
  body: {
    fontSize: 14,
    fontFamily: FONTS.sans,
    fontWeight: '400' as const,
  },
  bodySmall: {
    fontSize: 13,
    fontFamily: FONTS.sans,
    fontWeight: '400' as const,
  },

  // Labels (whispers)
  label: {
    fontSize: 10,
    fontFamily: FONTS.mono,
    fontWeight: '400' as const,
    letterSpacing: 0.3,
  },
  labelSmall: {
    fontSize: 9,
    fontFamily: FONTS.mono,
    fontWeight: '400' as const,
    letterSpacing: 0.3,
  },

  // Metadata / Details
  meta: {
    fontSize: 10,
    fontFamily: FONTS.mono,
    fontWeight: '300' as const,
  },
  metaSmall: {
    fontSize: 9,
    fontFamily: FONTS.mono,
    fontWeight: '300' as const,
  },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const RADIUS = {
  sm: 2,
  md: 8,
};

export const LIVING_FIELD = {
  spacing: 26,
  dotRadius: 1.25,
  dotAlphaDark: 0.11,
  dotAlphaLight: 0.16,
  breathMs: 3500,
};

/**
 * Interactive motion & glow tokens for `AliveProvider` and `LivingField`.
 * `ringReach` (520 px) and `waveSpeed` (1.1 px/ms) match the consumer worklet comments;
 * `lightInMs`, `trailMs`, `holdAfterCancelMs`, `scrollDrift`, and `litAlpha*` supply the
 * calibrated OGAM-owned defaults tested by `AliveProvider.test.tsx`.
 */
export const ALIVE = {
  lightInMs: 140,
  trailMs: 420,
  holdAfterCancelMs: 180,
  ringReach: 520,
  waveSpeed: 1.1,
  scrollDrift: 0.25,
  litAlphaDark: 0.85,
  litAlphaLight: 0.72,
} as const;
