import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, font, spacing } from '../theme';

export interface BarSeries {
  key: string;
  label: string;
  color: string;
}

export interface BarDatum {
  label: string;
  values: Record<string, number>;
}

/**
 * Dependency-free bar chart built from Views. Series are stacked within each
 * bar (e.g. cash + online). Scrolls horizontally when there are many bars.
 */
export function BarChart({
  data,
  series,
  height = 160,
  formatValue,
}: {
  data: BarDatum[];
  series: BarSeries[];
  height?: number;
  formatValue: (n: number) => string;
}) {
  const totals = data.map((d) => series.reduce((sum, s) => sum + (d.values[s.key] ?? 0), 0));
  const max = Math.max(...totals, 0);
  const barWidth = data.length > 14 ? 14 : 24;

  if (max === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>No data for this period</Text>
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.maxLabel}>Max {formatValue(max)}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={[styles.plot, { height: height + 22 }]}>
          {data.map((d, i) => (
            <View key={d.label + i} style={[styles.column, { width: barWidth + 8 }]}>
              <View style={[styles.barTrack, { height, width: barWidth }]}>
                {series.map((s) => {
                  const v = d.values[s.key] ?? 0;
                  if (v <= 0) return null;
                  return (
                    <View
                      key={s.key}
                      style={{ height: Math.max(2, (v / max) * height), backgroundColor: s.color, width: '100%' }}
                    />
                  );
                })}
              </View>
              <Text style={styles.xLabel} numberOfLines={1}>
                {d.label}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
      {series.length > 1 && (
        <View style={styles.legend}>
          {series.map((s) => (
            <View key={s.key} style={styles.legendItem}>
              <View style={[styles.swatch, { backgroundColor: s.color }]} />
              <Text style={styles.legendText}>{s.label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  plot: { flexDirection: 'row', alignItems: 'flex-end', paddingTop: spacing.xs },
  column: { alignItems: 'center' },
  // column-reverse stacks the first series at the bottom
  barTrack: { justifyContent: 'flex-start', flexDirection: 'column-reverse', borderTopLeftRadius: 4, borderTopRightRadius: 4, overflow: 'hidden' },
  xLabel: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  maxLabel: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.xs },
  legend: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  legendText: { fontSize: font.small, color: colors.textMuted },
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.textMuted, fontSize: font.small },
});
