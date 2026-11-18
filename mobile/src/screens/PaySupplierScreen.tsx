import { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { errorMessage } from '../api/client';
import { useAddSupplierPayment, useSupplier } from '../api/hooks';
import { Screen } from '../components/Screen';
import { ErrorState, Loading } from '../components/ui';
import { PaymentForm } from '../forms/PaymentForm';
import type { RootScreenProps } from '../navigation/types';
import { colors, font, spacing } from '../theme';
import { formatINR } from '../utils/money';

/** Record money paid to a supplier against their balance. */
export function PaySupplierScreen({ route, navigation }: RootScreenProps<'PaySupplier'>) {
  const { supplierId } = route.params;
  const { data: supplier, isLoading, error, refetch } = useSupplier(supplierId);
  const pay = useAddSupplierPayment(supplierId);
  const [submitError, setSubmitError] = useState<string>();

  if (isLoading) return <Loading />;
  if (error || !supplier) return <ErrorState message={errorMessage(error)} onRetry={refetch} />;

  return (
    <Screen>
      <Text style={styles.name}>{supplier.ownerName}</Text>
      <Text style={styles.hint}>The payment is taken off the total balance you owe this supplier.</Text>
      <PaymentForm
        duePaise={Math.max(Math.round(supplier.stats.balance * 100), 0)}
        dueLabel="Balance to pay"
        amountLabel="Amount paid"
        submitError={submitError}
        submitLabel="Save payment"
        onSubmit={async (input) => {
          setSubmitError(undefined);
          try {
            const p = await pay.mutateAsync(input);
            Alert.alert('Payment saved', `${formatINR(p.amount)} paid to ${supplier.ownerName}.`);
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
  name: { fontSize: font.title, fontWeight: '800', color: colors.text },
  hint: { fontSize: font.small, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.lg },
});
