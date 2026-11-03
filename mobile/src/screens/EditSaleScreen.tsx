import { useState } from 'react';
import { errorMessage } from '../api/client';
import { useSale, useUpdateSale } from '../api/hooks';
import type { SaleDetail } from '../api/types';
import { Screen } from '../components/Screen';
import { Banner, ErrorState, Loading } from '../components/ui';
import { SaleForm } from '../forms/SaleForm';
import { SaleFormValues, toSaleInput } from '../forms/saleSchema';
import type { RootScreenProps } from '../navigation/types';
import { toInputString } from '../utils/money';

/** Pre-fills the form; cash/online are the amounts received at the time of sale. */
function toFormValues(sale: SaleDetail): SaleFormValues {
  const atSale = (mode: 'CASH' | 'ONLINE') =>
    sale.payments.filter((p) => p.source === 'SALE_ENTRY' && p.paymentMode === mode).reduce((s, p) => s + Math.round(p.amount * 100), 0);
  const laterPaymentsPaise = sale.payments
    .filter((p) => p.source === 'COLLECTION')
    .reduce((s, p) => s + Math.round(p.amount * 100), 0);
  const onlineRef = sale.payments.find((p) => p.source === 'SALE_ENTRY' && p.paymentMode === 'ONLINE')?.transactionReference;
  return {
    customer: sale.customer,
    saleDate: sale.saleDate,
    weight: toInputString(sale.weight),
    ratePerKg: toInputString(sale.ratePerKg),
    cashReceived: toInputString(atSale('CASH') / 100),
    onlineReceived: toInputString(atSale('ONLINE') / 100),
    onlineReference: onlineRef ?? '',
    notes: sale.notes,
    laterPaymentsPaise,
  };
}

export function EditSaleScreen({ route, navigation }: RootScreenProps<'EditSale'>) {
  const { id } = route.params;
  const { data: sale, isLoading, error, refetch } = useSale(id);
  const updateSale = useUpdateSale(id);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (isLoading) return <Loading />;
  if (error || !sale) return <ErrorState message={errorMessage(error)} onRetry={refetch} />;

  const onSubmit = async (values: SaleFormValues) => {
    setSubmitError(null);
    try {
      await updateSale.mutateAsync(toSaleInput(values));
      navigation.goBack();
      return true;
    } catch (e) {
      setSubmitError(errorMessage(e));
      return false;
    }
  };

  return (
    <Screen>
      {submitError && <Banner tone="error" message={submitError} />}
      <SaleForm defaultValues={toFormValues(sale)} onSubmit={onSubmit} submitLabel="Save changes" isEdit />
    </Screen>
  );
}
