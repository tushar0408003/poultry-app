import { Alert, StyleSheet, Text, View } from 'react-native';
import { errorMessage } from '../api/client';
import { useDeletePayment, useDeleteSale, useSale } from '../api/hooks';
import type { Payment } from '../api/types';
import { PaymentRow, StatusBadge } from '../components/ledger';
import { Screen } from '../components/Screen';
import { Button, Card, Divider, ErrorState, Loading, Row, SectionTitle } from '../components/ui';
import type { RootScreenProps } from '../navigation/types';
import { colors, font, spacing } from '../theme';
import { formatDate } from '../utils/dates';
import { formatINR, formatKg } from '../utils/money';

export function SaleDetailScreen({ route, navigation }: RootScreenProps<'SaleDetail'>) {
  const { id } = route.params;
  const { data: sale, isLoading, error, refetch, isRefetching } = useSale(id);
  const deleteSale = useDeleteSale();
  const deletePayment = useDeletePayment();

  if (isLoading) return <Loading />;
  if (error || !sale) return <ErrorState message={errorMessage(error)} onRetry={refetch} />;

  const confirmDeleteSale = () => {
    const n = sale.payments.length;
    Alert.alert(
      'Delete this sale?',
      `${formatINR(sale.totalAmount)} sale to ${sale.customer?.shopName ?? 'customer'} on ${formatDate(sale.saleDate)}.` +
        (n > 0 ? `\n\nIts ${n} payment record${n === 1 ? '' : 's'} (${formatINR(sale.totalPaid)}) will also be deleted.` : '') +
        '\n\nThis cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSale.mutateAsync(id);
              navigation.goBack();
            } catch (e) {
              Alert.alert('Could not delete', errorMessage(e));
            }
          },
        },
      ],
    );
  };

  const confirmDeletePayment = (p: Payment) => {
    Alert.alert(
      'Delete this payment?',
      `${formatINR(p.amount)} ${p.paymentMode === 'CASH' ? 'cash' : 'online'} on ${formatDate(p.paymentDate)}.\n\nUse this only to fix a wrong entry. The balance will go back up by ${formatINR(p.amount)}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deletePayment.mutateAsync(p.id).catch((e) => Alert.alert('Could not delete', errorMessage(e))),
        },
      ],
    );
  };

  return (
    <Screen onRefresh={refetch} refreshing={isRefetching}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text
            style={styles.shop}
            onPress={() => sale.customer && navigation.navigate('CustomerDetail', { id: sale.customer.id })}
          >
            {sale.customer?.shopName ?? 'Unknown shop'}
          </Text>
          <Text style={styles.date}>{formatDate(sale.saleDate)}</Text>
        </View>
        <StatusBadge status={sale.status} />
      </View>

      <Card>
        <Row label="Weight" value={formatKg(sale.weight)} />
        <Row label="Rate per kg" value={formatINR(sale.ratePerKg)} />
        <Row label="Total amount" value={formatINR(sale.totalAmount)} color={colors.sales} bold />
        <Divider />
        <Row label="Cash received" value={formatINR(sale.cashReceived)} color={colors.received} />
        <Row label="Online received" value={formatINR(sale.onlineReceived)} color={colors.received} />
        <Row label="Total received" value={formatINR(sale.totalPaid)} color={colors.received} bold />
        <Row
          label="Remaining balance"
          value={formatINR(sale.remainingBalance)}
          color={sale.remainingBalance > 0 ? colors.due : colors.received}
          bold
        />
        {sale.notes ? (
          <>
            <Divider />
            <Text style={styles.notes}>{sale.notes}</Text>
          </>
        ) : null}
      </Card>

      {sale.remainingBalance > 0 && (
        <Button
          title="Add payment"
          variant="success"
          icon="cash-outline"
          onPress={() => navigation.navigate('AddPayment', { saleId: id })}
          style={{ marginTop: spacing.lg }}
        />
      )}

      <SectionTitle>Payment history</SectionTitle>
      <Card style={{ paddingVertical: 0 }}>
        {sale.payments.length === 0 ? (
          <Text style={styles.none}>No payments received yet.</Text>
        ) : (
          sale.payments.map((p) => <PaymentRow key={p.id} payment={p} onDelete={() => confirmDeletePayment(p)} />)
        )}
      </Card>

      <View style={styles.actions}>
        <Button title="Edit sale" variant="secondary" icon="create-outline" onPress={() => navigation.navigate('EditSale', { id })} style={{ flex: 1 }} />
        <Button title="Delete" variant="danger" icon="trash-outline" onPress={confirmDeleteSale} loading={deleteSale.isPending} style={{ flex: 1 }} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  shop: { fontSize: font.heading, fontWeight: '800', color: colors.primary },
  date: { fontSize: font.body, color: colors.textMuted, marginTop: 2 },
  notes: { fontSize: font.body, color: colors.text },
  none: { color: colors.textMuted, paddingVertical: spacing.lg },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
});
