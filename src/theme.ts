// V1 palette ported 1:1 (ui/theme/Theme.kt). Dark-only, like V1.

export const colors = {
  bg: '#0F1115',
  panel: '#181B22',
  panel2: '#1F232C',
  border: '#2A2F3A',
  text: '#E8EAF0',
  textDim: '#9AA1AF',
  accent: '#FF3D3D',
  accentDim: '#B32020',
  ok: '#3ECF6E',
  warn: '#F0B429',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;