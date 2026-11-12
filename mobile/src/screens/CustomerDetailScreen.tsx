import { useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { errorMessage } from '../api/client';
import { useCustomer, useCustomerPayments, useDeleteCustomer, useSalesInfinite } from '../api/hooks';
import { PaymentRow, SaleRow } from '../components/ledger';
import { Screen } from '../components/Screen';
import { StatCard, StatGrid } from '../components/StatCard';
import { Button, Card, EmptyState, ErrorState, IconButton, Loading, Segmented, SectionTitle } from '../components/ui';
import type { RootScreenProps } from '../navigation/types';
import { colors, font, spacing } from '../theme';
import { formatDate } from '../utils/dates';
import { formatINR, formatKg } from '../utils/money';

/** Customer profile: lifetime totals, outstanding balance, sales and payment history. */
export function CustomerDetailScreen({ route, navigation }: RootScreenProps<'CustomerDetail'>) {
  const { id } = route.params;
  const { data: customer, isLoading, error, refetch, isRefetching } = useCustomer(id);
  const sales = useSalesInfinite({ customerId: id });
  const payments = useCustomerPayments(id);
  const deleteCustomer = useDeleteCustomer();
  const [tab, setTab] = useState<'sales' | 'payments'>('sales');

  useLayoutEffect(() => {
    navigation.setOptions({
      title: customer?.ownerName ?? 'Customer',
      headerRight: () => <IconButton icon="create-outline" label="Edit customer" onPress={() => navigation.navigate('CustomerForm', { id })} />,
    });
  }, [navigation, customer, id]);

  if (isLoading) return <Loading />;
  if (error || !customer) return <ErrorState message={errorMessage(error)} onRetry={refetch} />;

  const s = customer.stats;
  const saleItems = sales.data?.pages.flatMap((p) => p.items) ?? [];
  const paymentItems = payments.data?.pages.flatMap((p) => p.items) ?? [];
  const active = tab === 'sales' ? sales : payments;

  const confirmDelete = () =>
    Alert.alert('Delete customer?', `${customer.ownerName} will be removed. This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCustomer.mutateAsync(id);
            navigation.goBack();
          } catch (e) {
            Alert.alert('Could not delete', errorMessage(e));
          }
        },
      },
    ]);

  return (
    <Screen
      onRefresh={() => {
        refetch();
        sales.refetch();
        payments.refetch();
      }}
      refreshing={isRefetching}
    >
      {(customer.phone || customer.address) && (
        <View style={styles.contact}>
          {customer.phone ? (
            <Text style={[styles.contactText, styles.phone]} onPress={() => Linking.openURL(`tel:${customer.phone}`)}>
              {customer.phone}
            </Text>
          ) : null}
          {customer.address ? <Text style={styles.contactMuted}>{customer.address}</Text> : null}
        </View>
      )}

      <StatGrid>
        <StatCard label="Outstanding balance" value={formatINR(s.outstandingBalance)} tone={s.outstandingBalance > 0 ? 'due' : 'received'} wide />
        <StatCard label="Weight" value={formatKg(s.weight)} />
        <StatCard label="Sales" value={formatINR(s.sales)} tone="sales" footnote={`${s.salesCount} sales`} />
        <StatCard label="Total" value={formatINR(s.total)} wide footnote={customer.outstanding > 0 ? `Incl. ${formatINR(customer.outstanding)} outstanding` : undefined} />
        <StatCard label="Online payment" value={formatINR(s.onlinePayment)} tone="received" />
        <StatCard label="Offline payment" value={formatINR(s.offlinePayment)} tone="received" footnote={s.lastPaymentDate ? `Last payment ${formatDate(s.lastPaymentDate)}` : undefined} />
      </StatGrid>

      {s.outstandingBalance > 0 && (
        <Button
          title="Receive payment"
          variant="success"
          icon="cash-outline"
          onPress={() => navigation.navigate('CollectPayment', { customerId: id })}
          style={{ marginTop: spacing.lg }}
        />
      )}

      <SectionTitle>History</SectionTitle>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'sales', label: `Sales (${s.salesCount})` },
          { value: 'payments', label: 'Payments' },
        ]}
      />
      <Card style={styles.list}>
        {active.isLoading ? (
          <ActivityIndicator style={{ margin: spacing.lg }} />
        ) : active.error ? (
          <ErrorState message={errorMessage(active.error)} onRetry={active.refetch} />
        ) : tab === 'sales' ? (
          saleItems.length === 0 ? (
            <EmptyState message="No sales yet." />
          ) : (
            saleItems.map((sale) => (
              <SaleRow
                key={sale.id}
                sale={sale}
                showCustomer={false}
                onPress={() => navigation.navigate('SaleDetail', { id: sale.id })}
                onEdit={() => navigation.navigate('EditSale', { id: sale.id })}
              />
            ))
          )
        ) : paymentItems.length === 0 ? (
          <EmptyState message="No payments yet." />
        ) : (
          <View style={{ paddingHorizontal: spacing.lg }}>
            {paymentItems.map((p) => (
              <PaymentRow key={p.id} payment={p} />
            ))}
          </View>
        )}
      </Card>
      {active.hasNextPage && (
        <Button title="Load more" variant="secondary" onPress={() => active.fetchNextPage()} loading={active.isFetchingNextPage} style={{ marginTop: spacing.md }} />
      )}

      {s.salesCount === 0 && (
        <Button title="Delete customer" variant="danger" icon="trash-outline" onPress={confirmDelete} style={{ marginTop: spacing.xl }} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  contact: { marginBottom: spacing.lg },
  contactText: { fontSize: font.body + 1, color: colors.text, fontWeight: '600' },
  phone: { color: colors.primary, marginTop: 2 },
  contactMuted: { fontSize: font.small, color: colors.textMuted, marginTop: 2 },
  list: { padding: 0, overflow: 'hidden', marginTop: spacing.md },
});
