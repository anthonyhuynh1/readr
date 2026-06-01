/** Readr brand palette and typography tokens. */
export const theme = {
  colors: {
    brandOrange: '#FF6B00',
    trueBlack: '#000000',
    white: '#FFFFFF',
    dimmedText: 'rgba(0, 0, 0, 0.4)',
    dimmedTextPlaying: 'rgba(0, 0, 0, 0.4)',
    activeText: '#000000',
    surface: '#FFFFFF',
    overlay: 'rgba(0, 0, 0, 0.6)',
    border: 'rgba(0, 0, 0, 0.08)',
  },
  opacity: {
    active: 1,
    dimmed: 0.4,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  typography: {
    reader: {
      fontSize: 20,
      lineHeight: 34,
      letterSpacing: 0.2,
    },
    title: {
      fontSize: 13,
      letterSpacing: 1.2,
      fontWeight: '500' as const,
    },
    caption: {
      fontSize: 12,
      letterSpacing: 0.5,
    },
  },
} as const;
