import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { errorMessage } from '../api/client';
import { useAddPayment, useSale } from '../api/hooks';
import { Screen } from '../components/Screen';
import { ErrorState, Loading } from '../components/ui';
import { PaymentForm } from '../forms/PaymentForm';
import type { RootScreenProps } from '../navigation/types';
import { colors, font, spacing } from '../theme';
import { formatDate } from '../utils/dates';
import { formatINR, saleDuePaise } from '../utils/money';

/** Records a later payment against one sale. */
export function AddPaymentScreen({ route, navigation }: RootScreenProps<'AddPayment'>) {
  const { saleId } = route.params;
  const { data: sale, isLoading, error, refetch } = useSale(saleId);
  const addPayment = useAddPayment(saleId);
  const [submitError, setSubmitError] = useState<string>();

  if (isLoading) return <Loading />;
  if (error || !sale) return <ErrorState message={errorMessage(error)} onRetry={refetch} />;

  return (
    <Screen>
      <Text style={styles.context}>
        {sale.customer?.ownerName} · {formatDate(sale.saleDate)} · Sale {formatINR(sale.totalAmount)}
      </Text>
      <PaymentForm
        duePaise={saleDuePaise(sale)}
        minimumDate={sale.saleDate}
        submitError={submitError}
        onSubmit={async (input) => {
          setSubmitError(undefined);
          try {
            await addPayment.mutateAsync(input);
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
  context: { fontSize: font.body, color: colors.textMuted, marginBottom: spacing.md },
});
