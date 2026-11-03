import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, spacing } from '../theme';

export type StatTone = 'neutral' | 'sales' | 'received' | 'due';

const TONES: Record<StatTone, { fg: string; bg: string }> = {
  neutral: { fg: colors.text, bg: colors.surface },
  sales: { fg: colors.sales, bg: colors.salesBg },
  received: { fg: colors.received, bg: colors.receivedBg },
  due: { fg: colors.due, bg: colors.dueBg },
};

/** Big-number summary card used on the dashboard and in reports. */
export function StatCard({
  label,
  value,
  tone = 'neutral',
  icon,
  footnote,
  wide,
}: {
  label: string;
  value: string;
  tone?: StatTone;
  icon?: keyof typeof Ionicons.glyphMap;
  footnote?: string;
  wide?: boolean;
}) {
  const t = TONES[tone];
  return (
    <View style={[styles.card, { backgroundColor: t.bg }, wide && styles.wide]} accessible accessibilityLabel={`${label}: ${value}`}>
      <View style={styles.top}>
        {icon && <Ionicons name={icon} size={18} color={t.fg} />}
        <Text style={styles.label} numberOfLines={2}>
          {label}
        </Text>
      </View>
      <Text style={[styles.value, { color: t.fg }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {footnote && <Text style={styles.footnote}>{footnote}</Text>}
    </View>
  );
}

/** Two-column wrapping grid for StatCards. */
export function StatGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.md },
  card: { width: '48.5%', borderRadius: radius.md, padding: spacing.md, minHeight: 96, justifyContent: 'space-between' },
  wide: { width: '100%' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: font.small, color: colors.textMuted, fontWeight: '600', flex: 1 },
  value: { fontSize: font.big - 4, fontWeight: '800', marginTop: spacing.sm },
  footnote: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
