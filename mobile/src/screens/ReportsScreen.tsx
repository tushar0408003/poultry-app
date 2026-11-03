import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { errorMessage } from '../api/client';
import { useReport } from '../api/hooks';
import type { Report, ReportKind } from '../api/types';
import { BarChart } from '../components/BarChart';
import { DateField } from '../components/DateField';
import { Screen } from '../components/Screen';
import { StatCard, StatGrid } from '../components/StatCard';
import { Card, ErrorState, Loading, Muted, Segmented, SectionTitle } from '../components/ui';
import { colors, font, spacing } from '../theme';
import { addDaysString, addMonthsString, chartLabel, formatDate, formatMonth, todayString } from '../utils/dates';
import { formatINR, formatKg } from '../utils/money';

const KINDS: { value: ReportKind; label: string }[] = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
  { value: 'custom', label: 'Custom' },
];

export function ReportsScreen() {
  const today = todayString();
  const [kind, setKind] = useState<ReportKind>('day');
  const [date, setDate] = useState(today);
  const [from, setFrom] = useState(addDaysString(today, -6));
  const [to, setTo] = useState(today);

  const params = kind === 'custom' ? { from, to } : { date };
  const { data, isLoading, error, refetch, isRefetching, isPlaceholderData } = useReport(kind, params);

  const step = (dir: -1 | 1) => {
    const next =
      kind === 'day' ? addDaysString(date, dir) : kind === 'week' ? addDaysString(date, 7 * dir) : addMonthsString(date, dir);
    setDate(next > today ? today : next);
  };

  return (
    <Screen onRefresh={refetch} refreshing={isRefetching}>
      <Segmented value={kind} onChange={setKind} options={KINDS} />
      <View style={{ height: spacing.md }} />

      {kind === 'custom' ? (
        <View style={styles.rangeRow}>
          <View style={{ flex: 1 }}>
            <Muted>From</Muted>
            <DateField value={from} onChange={(d) => { setFrom(d); if (d > to) setTo(d); }} compact />
          </View>
          <View style={{ flex: 1 }}>
            <Muted>To</Muted>
            <DateField value={to} onChange={(d) => { setTo(d); if (d < from) setFrom(d); }} minimumDate={from} compact />
          </View>
        </View>
      ) : (
        <View style={styles.stepper}>
          <StepButton icon="chevron-back" label="Previous period" onPress={() => step(-1)} />
          <View style={{ flex: 1 }}>
            <DateField value={date} onChange={setDate} compact />
          </View>
          <StepButton icon="chevron-forward" label="Next period" onPress={() => step(1)} disabled={data ? data.to >= today : true} />
        </View>
      )}

      {isLoading ? (
        <Loading />
      ) : error || !data ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : (
        <View style={{ opacity: isPlaceholderData ? 0.5 : 1 }}>
          <ReportBody report={data} />
        </View>
      )}
    </Screen>
  );
}

function ReportBody({ report: r }: { report: Report }) {
  const period =
    r.kind === 'day' ? formatDate(r.from) : r.kind === 'month' ? formatMonth(r.from) : `${formatDate(r.from)} – ${formatDate(r.to)}`;
  const previousLabel = r.kind === 'day' ? 'previous day' : r.kind === 'week' ? 'previous week' : r.kind === 'month' ? 'previous month' : 'previous period';
  const showChart = r.kind !== 'day' && r.series.points.length > 1;
  const points = r.series.points.map((p) => ({ ...p, label: chartLabel(p.label, r.series.granularity) }));

  return (
    <>
      <Text style={styles.period}>{period}</Text>

      <SectionTitle>Sales (by sale date)</SectionTitle>
      <StatGrid>
        <StatCard label="Weight sold" value={formatKg(r.sales.totalWeight)} icon="scale-outline" footnote={change(r.comparison.totalWeight, previousLabel)} />
        <StatCard label="Sales amount" value={formatINR(r.sales.totalAmount)} tone="sales" icon="trending-up" footnote={change(r.comparison.totalSales, previousLabel)} />
      </StatGrid>
      <Muted style={{ marginTop: spacing.sm }}>
        {r.sales.count} sale{r.sales.count === 1 ? '' : 's'} · of which {formatINR(r.sales.stillUnpaid)} is still unpaid
      </Muted>

      <SectionTitle>Collections (by payment date)</SectionTitle>
      <StatGrid>
        <StatCard label="Cash" value={formatINR(r.collections.cash)} tone="received" icon="cash-outline" />
        <StatCard label="Online" value={formatINR(r.collections.online)} tone="received" icon="phone-portrait-outline" />
        <StatCard label="Total collection" value={formatINR(r.collections.total)} tone="received" icon="wallet-outline" footnote={change(r.comparison.totalCollected, previousLabel)} wide />
      </StatGrid>
      <Muted style={{ marginTop: spacing.sm }}>Includes payments received for older sales.</Muted>

      <SectionTitle>Outstanding balance</SectionTitle>
      <StatCard
        label="Unpaid across all sales, as of now"
        value={formatINR(r.currentOutstanding.amount)}
        tone="due"
        icon="alert-circle-outline"
        footnote={`${r.currentOutstanding.customers} customers · ${r.currentOutstanding.sales} sales`}
        wide
      />

      {showChart && (
        <>
          <SectionTitle>Sales chart</SectionTitle>
          <Card>
            <BarChart
              data={points.map((p) => ({ label: p.label, values: { sales: p.sales } }))}
              series={[{ key: 'sales', label: 'Sales', color: colors.sales }]}
              formatValue={(n) => formatINR(n)}
            />
          </Card>

          <SectionTitle>Payment collection chart</SectionTitle>
          <Card>
            <BarChart
              data={points.map((p) => ({ label: p.label, values: { cash: p.cash, online: p.online } }))}
              series={[
                { key: 'cash', label: 'Cash', color: colors.received },
                { key: 'online', label: 'Online', color: colors.online },
              ]}
              formatValue={(n) => formatINR(n)}
            />
          </Card>
        </>
      )}

      <SectionTitle>Compared with {previousLabel}</SectionTitle>
      <Card>
        <Muted>{`${formatDate(r.previous.from)} – ${formatDate(r.previous.to)}`}</Muted>
        <CompareRow label="Weight sold" now={formatKg(r.sales.totalWeight)} before={formatKg(r.previous.sales.totalWeight)} pct={r.comparison.totalWeight} />
        <CompareRow label="Sales" now={formatINR(r.sales.totalAmount)} before={formatINR(r.previous.sales.totalAmount)} pct={r.comparison.totalSales} />
        <CompareRow label="Collection" now={formatINR(r.collections.total)} before={formatINR(r.previous.collections.total)} pct={r.comparison.totalCollected} />
      </Card>
    </>
  );
}

function change(pct: number | null, label: string): string {
  if (pct === null) return `New vs ${label}`;
  if (pct === 0) return `Same as ${label}`;
  return `${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)}% vs ${label}`;
}

function CompareRow({ label, now, before, pct }: { label: string; now: string; before: string; pct: number | null }) {
  const color = pct === null || pct === 0 ? colors.textMuted : pct > 0 ? colors.received : colors.danger;
  return (
    <View style={styles.compareRow}>
      <Text style={styles.compareLabel}>{label}</Text>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.compareNow}>{now}</Text>
        <Text style={styles.compareBefore}>
          was {before}{' '}
          <Text style={{ color, fontWeight: '700' }}>{pct === null ? '' : pct === 0 ? '(same)' : `(${pct > 0 ? '+' : ''}${pct}%)`}</Text>
        </Text>
      </View>
    </View>
  );
}

function StepButton({ icon, label, onPress, disabled }: { icon: 'chevron-back' | 'chevron-forward'; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityLabel={label} style={[styles.stepButton, disabled && { opacity: 0.3 }]} hitSlop={6}>
      <Ionicons name={icon} size={24} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rangeRow: { flexDirection: 'row', gap: spacing.md },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.surface },
  period: { fontSize: font.title, fontWeight: '800', color: colors.text, marginTop: spacing.lg },
  compareRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  compareLabel: { fontSize: font.body, color: colors.textMuted },
  compareNow: { fontSize: font.body, fontWeight: '700', color: colors.text },
  compareBefore: { fontSize: font.small, color: colors.textMuted },
});
