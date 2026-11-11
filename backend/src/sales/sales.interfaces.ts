import type { PaymentStatus } from '../common/money';
import type { Customer } from '../customers/customer.schema';
import type { Sale } from './sale.schema';
import type { Types } from 'mongoose';
import type { PaymentResponse } from '../payments/payments.interfaces';

export interface SaleTotals {
  cashPaid: number;
  onlinePaid: number;
  totalPaid: number;
  remaining: number;
}

export interface CustomerSummary {
  id: string;
  ownerName: string;
  phone: string;
}

export interface SaleResponse {
  id: string;
  customerId: string;
  customer: CustomerSummary | null;
  saleDate: string;
  weight: number;
  totalAmount: number;
  cashReceived: number;
  onlineReceived: number;
  status: PaymentStatus;
  notes: string;
}

export type CustomerRef = Pick<Customer, '_id' | 'ownerName' | 'phone'>;

export type SaleWithCustomer = Omit<Sale, 'customerId'> & { customerId: CustomerRef | null };

export interface SalesTotals {
  count: number;
  weight: number;
  totalAmount: number;
  totalPaid: number;
  remaining: number;
}

export interface CustomerSalesStats extends SalesTotals {
  customerId: Types.ObjectId;
  cashPaidPaise: number;
  onlinePaidPaise: number;
  lastSaleDate: Date | null;
}

export interface SeriesBucket {
  _id: string;
  weightGrams: number;
  totalAmountPaise: number;
}

export type SaleDetailResponse = SaleResponse & { payments: PaymentResponse[] };
