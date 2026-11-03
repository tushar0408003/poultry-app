import { Types } from 'mongoose';
import { formatDateOnly } from '../common/dates';
import { gramsToKg, paiseToRupees, PaymentStatus, paymentStatus } from '../common/money';
import type { Sale } from './sale.schema';
import type { CustomerRef, SaleWithCustomer } from './sales.repository';

export interface CustomerSummary {
  id: string;
  shopName: string;
  ownerName: string;
  phone: string;
}

export interface SaleResponse {
  id: string;
  customerId: string;
  customer: CustomerSummary | null;
  saleDate: string;
  weight: number;
  ratePerKg: number;
  totalAmount: number;
  cashReceived: number;
  onlineReceived: number;
  totalPaid: number;
  remainingBalance: number;
  status: PaymentStatus;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

export function toCustomerSummary(ref: CustomerRef | Types.ObjectId | null): CustomerSummary | null {
  if (!ref || ref instanceof Types.ObjectId || !('shopName' in ref)) return null;
  return { id: ref._id.toString(), shopName: ref.shopName, ownerName: ref.ownerName ?? '', phone: ref.phone ?? '' };
}

function customerIdOf(ref: CustomerRef | Types.ObjectId | null): string {
  if (!ref) return '';
  return ref instanceof Types.ObjectId ? ref.toString() : ref._id.toString();
}

export function toSaleResponse(sale: Sale | SaleWithCustomer): SaleResponse {
  const ref = sale.customerId as CustomerRef | Types.ObjectId | null;
  return {
    id: sale._id.toString(),
    customerId: customerIdOf(ref),
    customer: toCustomerSummary(ref),
    saleDate: formatDateOnly(sale.saleDate),
    weight: gramsToKg(sale.weightGrams),
    ratePerKg: paiseToRupees(sale.ratePaise),
    totalAmount: paiseToRupees(sale.totalAmountPaise),
    cashReceived: paiseToRupees(sale.cashPaidPaise),
    onlineReceived: paiseToRupees(sale.onlinePaidPaise),
    totalPaid: paiseToRupees(sale.totalPaidPaise),
    remainingBalance: paiseToRupees(sale.remainingPaise),
    status: paymentStatus(sale.totalAmountPaise, sale.totalPaidPaise),
    notes: sale.notes ?? '',
    createdAt: sale.createdAt,
    updatedAt: sale.updatedAt,
  };
}
