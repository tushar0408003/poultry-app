import { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { errorMessage } from '../api/client';
import { useAllocatePayment, useCustomer } from '../api/hooks';
import { Screen } from '../components/Screen';
import { ErrorState, Loading } from '../components/ui';
import { PaymentForm } from '../forms/PaymentForm';
import type { RootScreenProps } from '../navigation/types';
import { colors, font, spacing } from '../theme';
import { formatINR } from '../utils/money';

/**
 * Receive a lump-sum payment from a customer. The server applies it to the
 * outstanding, then the oldest unpaid sales, with one payment record per target.
 */
export function CollectPaymentScreen({ route, navigation }: RootScreenProps<'CollectPayment'>) {
  const { customerId } = route.params;
  const { data: customer, isLoading, error, refetch } = useCustomer(customerId);
  const allocate = useAllocatePayment(customerId);
  const [submitError, setSubmitError] = useState<string>();

  if (isLoading) return <Loading />;
  if (error || !customer) return <ErrorState message={errorMessage(error)} onRetry={refetch} />;

  return (
    <Screen>
      <Text style={styles.shop}>{customer.shopName}</Text>
      <Text style={styles.hint}>The payment clears the outstanding first, then the oldest unpaid sales.</Text>
      <PaymentForm
        duePaise={Math.round(customer.stats.outstandingBalance * 100)}
        submitError={submitError}
        submitLabel="Save payment"
        onSubmit={async (input) => {
          setSubmitError(undefined);
          try {
            const res = await allocate.mutateAsync(input);
            const n = res.payments.filter((p) => p.saleId).length;
            const old = res.payments.length > n ? ' and the outstanding' : '';
            Alert.alert('Payment saved', `${formatINR(res.totalAllocated)} applied to ${n} sale${n === 1 ? '' : 's'}${old}.`);
            navigation.goBack();
          } catch (e) {
            setSubmitError(errorMessage(e));
          }
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  shop: { fontSize: font.title, fontWeight: '800', color: colors.text },
  hint: { fontSize: font.small, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.lg },
});
