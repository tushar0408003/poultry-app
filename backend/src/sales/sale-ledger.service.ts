import { ConflictException, Injectable } from '@nestjs/common';
import type { ClientSession, Types } from 'mongoose';
import { PaymentsRepository } from '../payments/payments.repository';
import { SalesRepository } from './sales.repository';

export interface SaleTotals {
  cashPaidPaise: number;
  onlinePaidPaise: number;
  totalPaidPaise: number;
  remainingPaise: number;
}

export function computeTotals(totalAmountPaise: number, cashPaise: number, onlinePaise: number): SaleTotals {
  const totalPaidPaise = cashPaise + onlinePaise;
  return {
    cashPaidPaise: cashPaise,
    onlinePaidPaise: onlinePaise,
    totalPaidPaise,
    remainingPaise: totalAmountPaise - totalPaidPaise,
  };
}

/**
 * Keeps a sale's paid/remaining cache in sync with its payment records.
 * Always call inside the same transaction as the payment change.
 */
@Injectable()
export class SaleLedger {
  constructor(
    private readonly sales: SalesRepository,
    private readonly payments: PaymentsRepository,
  ) {}

  async sync(saleId: Types.ObjectId, totalAmountPaise: number, session?: ClientSession): Promise<SaleTotals> {
    const { cashPaise, onlinePaise } = await this.payments.totalsForSale(saleId, session);
    const totals = computeTotals(totalAmountPaise, cashPaise, onlinePaise);
    if (totals.remainingPaise < 0) {
      // Services validate before writing; reaching this means a concurrent change slipped in.
      // Throwing aborts the transaction so the overpayment is never committed.
      throw new ConflictException('The balance changed while saving. Please refresh and try again.');
    }
    await this.sales.updateById(saleId, totals, session);
    return totals;
  }
}
