import { useState } from 'react';
import { errorMessage } from '../api/client';
import { useCreateSale } from '../api/hooks';
import { Screen } from '../components/Screen';
import { Banner } from '../components/ui';
import { SaleForm } from '../forms/SaleForm';
import { SaleFormValues, toSaleInput } from '../forms/saleSchema';
import { todayString } from '../utils/dates';
import { formatINR } from '../utils/money';

const empty = (): SaleFormValues => ({
  customer: null,
  saleDate: todayString(),
  weight: '',
  ratePerKg: '',
  cashReceived: '',
  onlineReceived: '',
  onlineReference: '',
  notes: '',
  laterPaymentsPaise: 0,
});

export function AddSaleScreen() {
  const createSale = useCreateSale();
  const [banner, setBanner] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  const onSubmit = async (values: SaleFormValues): Promise<boolean> => {
    setBanner(null);
    try {
      const sale = await createSale.mutateAsync(toSaleInput(values));
      setBanner({
        tone: 'success',
        message: `Saved: ${formatINR(sale.totalAmount)} to ${sale.customer?.shopName ?? 'customer'}` +
          (sale.remainingBalance > 0 ? ` · Due ${formatINR(sale.remainingBalance)}` : ' · Fully paid'),
      });
      return true;
    } catch (e) {
      setBanner({ tone: 'error', message: errorMessage(e) });
      return false;
    }
  };

  return (
    <Screen>
      {banner && <Banner tone={banner.tone} message={banner.message} />}
      <SaleForm
        defaultValues={empty()}
        onSubmit={onSubmit}
        submitLabel="Save sale"
        // Keep the date and today's rate so the next sale is even quicker.
        resetAfterSubmit={(v) => ({ ...empty(), saleDate: v.saleDate, ratePerKg: v.ratePerKg })}
      />
    </Screen>
  );
}
