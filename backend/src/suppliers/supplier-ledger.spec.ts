import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { PaymentMode } from '../payments/payment.schema';
import { SuppliersService } from './suppliers.service';

const day = (s: string) => new Date(`${s}T00:00:00Z`);
const supplierId = new Types.ObjectId();
const supplier = { _id: supplierId, ownerName: 'Ravi Farms', outstandingPaise: 50_000, ratePaise: 9_500, weightGrams: 0 };

const purchases = [
  // 100 kg x ₹95 = ₹9,500, ₹2,000 cash paid with it
  { _id: new Types.ObjectId(), supplierId, purchaseDate: day('2026-11-02'), weightGrams: 100_000, ratePaise: 9_500, totalPaise: 950_000, cashPaidPaise: 200_000, onlinePaidPaise: 0 },
  // 50 kg x ₹100 = ₹5,000, nothing paid
  { _id: new Types.ObjectId(), supplierId, purchaseDate: day('2026-11-05'), weightGrams: 50_000, ratePaise: 10_000, totalPaise: 500_000, cashPaidPaise: 0, onlinePaidPaise: 0 },
];
const payments = [
  // Same day as the second purchase: must come after it.
  { _id: new Types.ObjectId(), supplierId, paymentDate: day('2026-11-05'), amountPaise: 300_000, paymentMode: PaymentMode.ONLINE, transactionReference: 'UPI123' },
];

function service(calls: string[] = []) {
  const suppliers = {
    findById: async () => supplier,
    deleteById: async () => (calls.push('supplier'), true),
  };
  const purchasesRepo = {
    findAllBySupplier: async () => purchases,
    deleteBySupplier: async () => (calls.push('purchases'), purchases.length),
    supplierStats: async () => [{ _id: supplierId, count: 2, weightGrams: 150_000, totalPaise: 1_450_000, paidPaise: 200_000 }],
  };
  const paymentsRepo = {
    findBySupplier: async () => payments,
    totals: async () => [{ _id: supplierId, count: 1, totalPaise: 300_000 }],
    create: async (data: object) => ({ _id: new Types.ObjectId(), ...data }),
    deleteBySupplier: async () => (calls.push('payments'), payments.length),
  };
  const tx = { run: <T>(work: (s: undefined) => Promise<T>) => work(undefined) };
  const clock = { today: () => day('2026-11-18'), isFuture: (d: Date) => d > day('2026-11-18') };
  return new SuppliersService(suppliers as never, purchasesRepo as never, paymentsRepo as never, tx as never, clock as never);
}

describe('SuppliersService.remove', () => {
  it('deletes the supplier with all purchases and payments', async () => {
    const calls: string[] = [];
    const res = await service(calls).remove(supplierId);
    expect(res).toEqual({ deleted: true, purchasesDeleted: 2, paymentsDeleted: 1 });
    expect(calls).toEqual(['purchases', 'payments', 'supplier']);
  });
});

describe('SuppliersService.ledger', () => {
  it('lists old dues, purchases and payments in date order with a running balance', async () => {
    const ledger = await service().ledger(supplierId);
    expect(ledger.entries.map((e) => [e.type, e.debit, e.credit, e.balance])).toEqual([
      ['OPENING', 500, 0, 500],
      ['PURCHASE', 9500, 2000, 8000],
      ['PURCHASE', 5000, 0, 13000],
      ['PAYMENT', 0, 3000, 10000],
    ]);
    expect(ledger).toMatchObject({ openingBalance: 500, totalPurchases: 14500, totalPaid: 5000, closingBalance: 10000 });
    expect(ledger.entries[3].description).toBe('Payment, Online (UPI123)');
  });
});

describe('SuppliersService.addPayment', () => {
  it('accepts a payment up to the balance', async () => {
    const p = await service().addPayment(supplierId, { amount: 10000, paymentMode: PaymentMode.CASH });
    expect(p.amount).toBe(10000);
  });

  it('rejects a payment above the balance', async () => {
    await expect(service().addPayment(supplierId, { amount: 10000.01, paymentMode: PaymentMode.CASH })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
