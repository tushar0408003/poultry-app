export const colors = {
  background: '#FFFFFF',
  surface: '#F6F7F9',
  border: '#E3E6EA',
  text: '#16181D',
  textMuted: '#667085',
  primary: '#1F5EFF',
  primaryText: '#FFFFFF',
  received: '#15803D', // green: money received
  receivedBg: '#ECFDF3',
  due: '#C2410C', // orange-red: money outstanding
  dueBg: '#FFF4ED',
  danger: '#B42318',
  dangerBg: '#FEF3F2',
  partial: '#B54708',
  partialBg: '#FFFAEB',
  sales: '#1F5EFF',
  salesBg: '#EEF4FF',
  online: '#6941C6',
  overlay: 'rgba(16, 24, 40, 0.45)',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const font = {
  small: 13,
  body: 16,
  label: 15,
  title: 20,
  heading: 24,
  big: 28,
} as const;

/** Minimum touch target for large, easy buttons. */
export const touch = { minHeight: 52 } as const;
