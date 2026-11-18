import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { PaymentMode, PaymentSource } from '../payments/payment.schema';
import { CustomersService } from './customers.service';

const day = (s: string) => new Date(`${s}T00:00:00Z`);
const customerId = new Types.ObjectId();
const sale1 = new Types.ObjectId();
const sale2 = new Types.ObjectId();
const sales = [
  { _id: sale1, customerId, saleDate: day('2026-11-02'), weight: 100, totalAmount: 9500.5 },
  { _id: sale2, customerId, saleDate: day('2026-11-05'), weight: 50, totalAmount: 5000 },
];
const pay = (saleId: Types.ObjectId | null, date: string, amount: number, mode: PaymentMode, source: PaymentSource, ref = '') => ({
  _id: new Types.ObjectId(), customerId, saleId, paymentDate: day(date), amount, paymentMode: mode, source, transactionReference: ref,
});
const payments = [
  pay(sale1, '2026-11-02', 2000, PaymentMode.CASH, PaymentSource.SALE_ENTRY),
  pay(sale1, '2026-11-02', 500.5, PaymentMode.ONLINE, PaymentSource.SALE_ENTRY),
  // Same day as the second sale: must come after it.
  pay(null, '2026-11-05', 3000, PaymentMode.ONLINE, PaymentSource.COLLECTION, 'UPI123'),
];

const service = () =>
  new CustomersService(
    { findById: async () => ({ _id: customerId, ownerName: 'Shyam', outstandingPaise: 50_000 }) } as never,
    { findAllByCustomer: async () => sales } as never,
    { findByCustomer: async () => payments } as never,
    {} as never,
  );

describe('CustomersService.ledger', () => {
  it('lists old dues, sales and payments in date order with a running balance', async () => {
    const ledger = await service().ledger(customerId);
    expect(ledger.entries.map((e) => [e.type, e.debit, e.credit, e.balance])).toEqual([
      ['OPENING', 500, 0, 500],
      ['SALE', 9500.5, 2500.5, 7500],
      ['SALE', 5000, 0, 12500],
      ['PAYMENT', 0, 3000, 9500],
    ]);
    expect(ledger).toMatchObject({ openingBalance: 500, totalSales: 14500.5, totalReceived: 5500.5, closingBalance: 9500 });
    expect(ledger.entries[1].description).toBe('Sale (received cash + online)');
    expect(ledger.entries[3].description).toBe('Payment, Online (UPI123)');
  });
});
