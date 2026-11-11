import { calculateSale, SaleFormValues, saleFormSchema, toSaleInput } from '../saleSchema';

const base: SaleFormValues = {
  customer: { id: '0123456789abcdef01234567', ownerName: 'Sharma', phone: '' },
  saleDate: '2026-10-01',
  weight: '50',
  ratePerKg: '200',
  cashReceived: '2000',
  onlineReceived: '3000',
  onlineReference: '',
  notes: '',
  laterPaymentsPaise: 0,
};

describe('sale form', () => {
  it('calculates the spec example', () => {
    expect(calculateSale(base)).toEqual({
      totalPaise: 1_000_000,
      cashPaise: 200_000,
      onlinePaise: 300_000,
      paidPaise: 500_000,
      remainingPaise: 500_000,
    });
  });

  it('includes later payments when editing', () => {
    expect(calculateSale({ ...base, laterPaymentsPaise: 200_000 }).remainingPaise).toBe(300_000);
  });

  it('accepts a valid sale and converts it for the API', () => {
    const parsed = saleFormSchema.parse(base);
    expect(toSaleInput(parsed)).toMatchObject({ weight: 50, ratePerKg: 200, cashReceived: 2000, onlineReceived: 3000 });
  });

  it.each([
    [{ customer: null }, 'Please select a customer'],
    [{ weight: '0' }, 'Weight must be more than 0'],
    [{ weight: '' }, 'Enter the weight'],
    [{ ratePerKg: '0' }, 'Rate must be more than 0'],
    [{ cashReceived: '-5' }, 'Enter a valid amount'],
    [{ cashReceived: '6000', onlineReceived: '5000' }, 'cannot be more than the sale amount'],
  ])('rejects %p', (override, message) => {
    const result = saleFormSchema.safeParse({ ...base, ...override });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain(message);
  });

  it('treats empty payments as zero (unpaid sale)', () => {
    const v = { ...base, cashReceived: '', onlineReceived: '' };
    expect(saleFormSchema.safeParse(v).success).toBe(true);
    expect(calculateSale(v).remainingPaise).toBe(1_000_000);
  });
});
