import type { Types } from 'mongoose';
import type { Payment, PaymentMode, PaymentSource } from './payment.schema';
import type { CustomerRef, CustomerSummary } from '../sales/sales.interfaces';

export interface PaymentResponse {
  id: string;
  saleId: string | null;
  customerId: string;
  customer: CustomerSummary | null;
  amount: number;
  paymentMode: PaymentMode;
  paymentDate: string;
  transactionReference: string;
  source: PaymentSource;
  createdAt: Date;
}

export type PaymentWithCustomer = Omit<Payment, 'customerId'> & { customerId: CustomerRef | null };

export interface CustomerPaymentStats {
  _id: Types.ObjectId;
  /** Paid against outstanding only. */
  cashPaise: number;
  onlinePaise: number;
  lastPaymentDate: Date | null;
}

export interface CollectionTotals {
  count: number;
  cashPaise: number;
  onlinePaise: number;
}

export interface CollectionBucket {
  _id: string;
  cashPaise: number;
  onlinePaise: number;
}
