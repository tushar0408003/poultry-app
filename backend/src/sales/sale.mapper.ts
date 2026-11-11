import { Types } from 'mongoose';
import { formatDateOnly } from '../common/dates';
import { paiseToRupees, paymentStatus } from '../common/money';
import type { Sale } from './sale.schema';
import type { CustomerRef, CustomerSummary, SaleResponse, SaleWithCustomer } from './sales.interfaces';

export function toCustomerSummary(ref: CustomerRef | Types.ObjectId | null): CustomerSummary | null {
  if (!ref || ref instanceof Types.ObjectId || !('ownerName' in ref)) return null;
  return { id: ref._id.toString(), ownerName: ref.ownerName ?? '', phone: ref.phone ?? '' };
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
    weight: sale.weight,
    totalAmount: paiseToRupees(sale.totalAmountPaise),
    cashReceived: paiseToRupees(sale.cashPaid),
    onlineReceived: paiseToRupees(sale.onlinePaid),
    status: paymentStatus(sale.totalAmountPaise, sale.totalPaid),
    notes: sale.notes ?? '',
  };
}
