import { useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { errorMessage } from '../api/client';
import { useDeleteSupplier, useDeleteSupplierPayment, useSupplier, useSupplierPayments, useSupplierPurchases } from '../api/hooks';
import type { Purchase, SupplierPayment } from '../api/types';
import { Screen } from '../components/Screen';
import { StatCard, StatGrid } from '../components/StatCard';
import { Button, Card, EmptyState, ErrorState, IconButton, Loading, Segmented, SectionTitle } from '../components/ui';
import type { RootScreenProps } from '../navigation/types';
import { colors, font, spacing } from '../theme';
import { formatDate } from '../utils/dates';
import { formatINR, formatKg } from '../utils/money';
import { usePullToRefresh } from '../utils/usePullToRefresh';

/** Supplier profile: rate, totals, balance owed, and purchase / payment history. */
export function SupplierDetailScreen({ route, navigation }: RootScreenProps<'SupplierDetail'>) {
  const { id } = route.params;
  const { data: supplier, isLoading, error, refetch } = useSupplier(id);
  const purchases = useSupplierPurchases(id);
  const payments = useSupplierPayments(id);
  const deleteSupplier = useDeleteSupplier();
  const deletePayment = useDeleteSupplierPayment(id);
  const [tab, setTab] = useState<'purchases' | 'payments'>('purchases');
  const pull = usePullToRefresh(() => Promise.all([refetch(), purchases.refetch(), payments.refetch()]));

  useLayoutEffect(() => {
    navigation.setOptions({
      title: supplier?.ownerName ?? 'Supplier',
      headerRight: () => <IconButton icon="create-outline" label="Edit supplier" onPress={() => navigation.navigate('SupplierForm', { id })} />,
    });
  }, [navigation, supplier, id]);

  if (isLoading) return <Loading />;
  if (error || !supplier) return <ErrorState message={errorMessage(error)} onRetry={refetch} />;

  const s = supplier.stats;
  const purchaseItems = purchases.data?.pages.flatMap((p) => p.items) ?? [];
  const advance = s.balance < 0;

  const history = [
    s.purchasesCount && `${s.purchasesCount} purchase${s.purchasesCount === 1 ? '' : 's'}`,
    s.paymentsCount && `${s.paymentsCount} payment${s.paymentsCount === 1 ? '' : 's'}`,
  ].filter(Boolean);
  const confirmDelete = () =>
    Alert.alert(
      'Delete supplier?',
      history.length
        ? `${supplier.ownerName} and all their history (${history.join(' and ')}) will be deleted. This cannot be undone.`
        : `${supplier.ownerName} will be removed. This cannot be undone.`,
      [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteSupplier.mutateAsync(id);
            navigation.goBack();
          } catch (e) {
            Alert.alert('Could not delete', errorMessage(e));
          }
        },
      },
      ],
    );

  const confirmDeletePayment = (p: SupplierPayment) =>
    Alert.alert('Delete payment?', `${formatINR(p.amount)} paid on ${formatDate(p.paymentDate)} will be removed and added back to the balance.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePayment.mutateAsync(p.id);
          } catch (e) {
            Alert.alert('Could not delete', errorMessage(e));
          }
        },
      },
    ]);

  return (
    <Screen
      {...pull}
    >
      {(supplier.phone || supplier.address) && (
        <View style={styles.contact}>
          {supplier.phone ? (
            <Text style={styles.phone} onPress={() => Linking.openURL(`tel:${supplier.phone}`)}>
              {supplier.phone}
            </Text>
          ) : null}
          {supplier.address ? <Text style={styles.muted}>{supplier.address}</Text> : null}
        </View>
      )}

      <StatGrid>
        <StatCard
          label={advance ? 'Advance paid' : 'Balance to pay'}
          value={formatINR(Math.abs(s.balance))}
          tone={s.balance > 0 ? 'due' : 'received'}
          wide
        />
        <StatCard label="Rate" value={`${formatINR(supplier.rate)}/kg`} />
        <StatCard label="Weight" value={formatKg(supplier.weight)} />
        <StatCard
          label="Purchases"
          value={formatINR(s.purchases)}
          tone="sales"
          footnote={`${s.purchasesCount} purchase${s.purchasesCount === 1 ? '' : 's'} · ${formatKg(s.weight)}`}
        />
        <StatCard
          label="Paid"
          value={formatINR(s.paid)}
          tone="received"
          footnote={supplier.outstanding > 0 ? `Old dues ${formatINR(supplier.outstanding)}` : undefined}
        />
      </StatGrid>

      <View style={styles.actions}>
        <Button
          title="Add purchase"
          icon="add-circle-outline"
          onPress={() => navigation.navigate('PurchaseForm', { supplierId: id })}
          style={styles.action}
        />
        {s.balance > 0 && (
          <Button
            title="Pay supplier"
            variant="success"
            icon="cash-outline"
            onPress={() => navigation.navigate('PaySupplier', { supplierId: id })}
            style={styles.action}
          />
        )}
      </View>
      <Button
        title="Balance sheet"
        variant="secondary"
        icon="document-text-outline"
        onPress={() => navigation.navigate('SupplierLedger', { supplierId: id })}
        style={{ marginTop: spacing.md }}
      />

      <SectionTitle>History</SectionTitle>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'purchases', label: `Purchases (${s.purchasesCount})` },
          { value: 'payments', label: `Payments (${s.paymentsCount})` },
        ]}
      />
      <Card style={styles.list}>
        {tab === 'purchases' ? (
          purchases.isLoading ? (
            <ActivityIndicator style={{ margin: spacing.lg }} />
          ) : purchases.error ? (
            <ErrorState message={errorMessage(purchases.error)} onRetry={purchases.refetch} />
          ) : purchaseItems.length === 0 ? (
            <EmptyState message="No purchases yet." />
          ) : (
            purchaseItems.map((p) => (
              <PurchaseRow key={p.id} purchase={p} onPress={() => navigation.navigate('PurchaseForm', { supplierId: id, id: p.id })} />
            ))
          )
        ) : payments.isLoading ? (
          <ActivityIndicator style={{ margin: spacing.lg }} />
        ) : payments.error ? (
          <ErrorState message={errorMessage(payments.error)} onRetry={payments.refetch} />
        ) : !payments.data?.length ? (
          <EmptyState message={s.paidAtPurchase > 0 ? 'No separate payments yet. Amounts paid with purchases are in the Purchases list.' : 'No payments yet.'} />
        ) : (
          payments.data.map((p) => <PaymentRow key={p.id} payment={p} onPress={() => confirmDeletePayment(p)} />)
        )}
      </Card>
      {tab === 'purchases' && purchases.hasNextPage && (
        <Button
          title="Load more"
          variant="secondary"
          onPress={() => purchases.fetchNextPage()}
          loading={purchases.isFetchingNextPage}
          style={{ marginTop: spacing.md }}
        />
      )}

      <Button
        title="Delete supplier"
        variant="danger"
        icon="trash-outline"
        onPress={confirmDelete}
        loading={deleteSupplier.isPending}
        style={{ marginTop: spacing.xl }}
      />
    </Screen>
  );
}

function PurchaseRow({ purchase: p, onPress }: { purchase: Purchase; onPress: () => void }) {
  const paidWith = p.cashPaid + p.onlinePaid;
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]} onPress={onPress}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{formatDate(p.purchaseDate)}</Text>
        <Text style={styles.muted}>
          {formatKg(p.weight)} × {formatINR(p.rate)}/kg
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.rowTitle}>{formatINR(p.totalAmount)}</Text>
        {/* Only what was paid WITH this purchase; later payments go against the whole balance. */}
        <Text style={[styles.muted, paidWith > 0 && { color: colors.received, fontWeight: '600' }]}>
          {p.remaining === 0 ? 'Paid in full' : paidWith > 0 ? `${formatINR(paidWith)} paid` : 'On credit'}
        </Text>
      </View>
    </Pressable>
  );
}

function PaymentRow({ payment: p, onPress }: { payment: SupplierPayment; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]} onPress={onPress}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{formatDate(p.paymentDate)}</Text>
        <Text style={styles.muted}>
          {p.paymentMode === 'CASH' ? 'Cash' : 'Online'}
          {p.transactionReference ? ` · ${p.transactionReference}` : ''}
          {p.notes ? ` · ${p.notes}` : ''}
        </Text>
      </View>
      <Text style={[styles.rowTitle, { color: colors.received }]}>{formatINR(p.amount)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contact: { marginBottom: spacing.lg },
  phone: { fontSize: font.body + 1, fontWeight: '600', color: colors.primary, marginTop: 2 },
  muted: { fontSize: font.small, color: colors.textMuted, marginTop: 2 },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  action: { flex: 1 },
  list: { padding: 0, overflow: 'hidden', marginTop: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowTitle: { fontSize: font.body + 1, fontWeight: '700', color: colors.text },
});
