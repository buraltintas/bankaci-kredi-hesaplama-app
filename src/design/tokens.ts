export const colors = {
  background: '#F4F7FB',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF3F8',
  border: '#D8E1EA',
  text: '#14213D',
  textMuted: '#607083',
  placeholder: '#9AA8B8',
  primary: '#0B5CAD',
  primaryDark: '#083D77',
  success: '#087F5B',
  danger: '#C92A2A',
  warning: '#E67700',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
};

export const typography = {
  title: 28,
  sectionTitle: 18,
  body: 15,
  small: 13,
};

export const shadows = {
  card: {
    shadowColor: '#0B1F33',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
};

/**
 * Premium accent — a blue-to-violet gradient and its icon, shared by every
 * surface that gates a feature so they read as one thing.
 */
export const premium = {
  gradient: ['#2F6BFF', '#8B5CF6'] as const,
  gradientStart: { x: 0, y: 0 },
  gradientEnd: { x: 1, y: 1 },
  accent: '#7C4DFF',
  onGradient: '#FFFFFF',
};
