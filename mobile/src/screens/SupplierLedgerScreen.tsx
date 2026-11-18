import { useLayoutEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { errorMessage } from '../api/client';
import { useSupplierLedger } from '../api/hooks';
import type { SupplierLedgerEntry } from '../api/types';
import { Screen } from '../components/Screen';
import { Card, EmptyState, ErrorState, Loading, SectionTitle } from '../components/ui';
import type { RootScreenProps } from '../navigation/types';
import { colors, font, spacing } from '../theme';
import { formatDate } from '../utils/dates';
import { formatINR, formatKg } from '../utils/money';

/**
 * Supplier balance sheet: old dues, then every purchase and payment in date order
 * with the running balance after each line.
 */
export function SupplierLedgerScreen({ route, navigation }: RootScreenProps<'SupplierLedger'>) {
  const { supplierId } = route.params;
  const { data, isLoading, error, refetch, isRefetching } = useSupplierLedger(supplierId);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Balance sheet' });
  }, [navigation]);

  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorState message={errorMessage(error)} onRetry={refetch} />;

  return (
    <Screen onRefresh={refetch} refreshing={isRefetching}>
      <Text style={styles.name}>{data.ownerName}</Text>
      <Card style={styles.summary}>
        <SummaryLine label="Old dues" value={formatINR(data.openingBalance)} />
        <SummaryLine label="+ Purchases" value={formatINR(data.totalPurchases)} color={colors.sales} />
        <SummaryLine label="− Paid" value={formatINR(data.totalPaid)} color={colors.received} />
        <View style={styles.summaryTotal}>
          <Text style={styles.totalLabel}>{balanceLabel(data.closingBalance)}</Text>
          <Text style={[styles.totalValue, { color: balanceColor(data.closingBalance) }]}>{formatINR(Math.abs(data.closingBalance))}</Text>
        </View>
      </Card>

      <SectionTitle>Statement</SectionTitle>
      <Card style={styles.card}>
        <View style={[styles.row, styles.head]}>
          <Text style={[styles.headText, styles.desc]}>Details</Text>
          <Text style={[styles.headText, styles.num]}>Purchase</Text>
          <Text style={[styles.headText, styles.num]}>Paid</Text>
          <Text style={[styles.headText, styles.num]}>Balance</Text>
        </View>
        {data.entries.length <= 1 && data.openingBalance === 0 ? (
          <EmptyState message="No purchases or payments yet." />
        ) : (
          data.entries.map((e) => <LedgerRow key={e.id} entry={e} />)
        )}
        <View style={[styles.row, styles.total]}>
          <Text style={[styles.totalText, styles.desc]}>Total</Text>
          <Text style={[styles.totalText, styles.num]}>{formatINR(data.openingBalance + data.totalPurchases)}</Text>
          <Text style={[styles.totalText, styles.num, { color: colors.received }]}>{formatINR(data.totalPaid)}</Text>
          <Text style={[styles.totalText, styles.num, { color: balanceColor(data.closingBalance) }]}>{formatINR(data.closingBalance)}</Text>
        </View>
      </Card>
      <Text style={styles.note}>Purchase = amount added to what you owe. Paid = money given to the supplier. Balance = still to pay.</Text>
    </Screen>
  );
}

function LedgerRow({ entry: e }: { entry: SupplierLedgerEntry }) {
  return (
    <View style={styles.row}>
      <View style={styles.desc}>
        <Text style={styles.date}>{e.date ? formatDate(e.date) : 'Opening'}</Text>
        <Text style={styles.text} numberOfLines={2}>
          {e.description}
        </Text>
        {e.weight !== null && e.rate !== null && (
          <Text style={styles.sub}>
            {formatKg(e.weight)} × {formatINR(e.rate)}/kg
          </Text>
        )}
      </View>
      <Text style={[styles.num, styles.value]}>{e.debit ? formatINR(e.debit) : '–'}</Text>
      <Text style={[styles.num, styles.value, { color: e.credit ? colors.received : colors.textMuted }]}>{e.credit ? formatINR(e.credit) : '–'}</Text>
      <Text style={[styles.num, styles.value, styles.bold, { color: balanceColor(e.balance) }]}>{formatINR(e.balance)}</Text>
    </View>
  );
}

function SummaryLine({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.summaryLine}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

const balanceLabel = (balance: number) => (balance < 0 ? 'Advance paid' : 'Balance to pay');
const balanceColor = (balance: number) => (balance > 0 ? colors.due : colors.received);

const styles = StyleSheet.create({
  name: { fontSize: font.title, fontWeight: '800', color: colors.text, marginBottom: spacing.md },
  summary: { paddingVertical: spacing.sm },
  summaryLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs + 2 },
  summaryLabel: { fontSize: font.body, color: colors.textMuted },
  summaryValue: { fontSize: font.body, fontWeight: '700', color: colors.text },
  summaryTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalLabel: { fontSize: font.body + 1, fontWeight: '800', color: colors.text },
  totalValue: { fontSize: font.title + 2, fontWeight: '800' },
  card: { padding: 0, overflow: 'hidden', marginTop: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  head: { backgroundColor: colors.surface, paddingVertical: spacing.sm },
  headText: { fontSize: font.small, fontWeight: '700', color: colors.textMuted },
  desc: { flex: 1.6 },
  num: { flex: 1, textAlign: 'right' },
  date: { fontSize: font.small, fontWeight: '700', color: colors.text },
  text: { fontSize: font.small, color: colors.text, marginTop: 2 },
  sub: { fontSize: font.small - 1, color: colors.textMuted, marginTop: 2 },
  value: { fontSize: font.small, color: colors.text },
  bold: { fontWeight: '700' },
  total: { backgroundColor: colors.surface, borderBottomWidth: 0 },
  totalText: { fontSize: font.small, fontWeight: '800', color: colors.text },
  note: { fontSize: font.small, color: colors.textMuted, marginTop: spacing.md },
});
