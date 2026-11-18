import { formatDateOnly } from '../common/dates';
import { gramsToKg, paiseToRupees, paymentStatus } from '../common/money';
import type { PurchaseResponse, PurchaseWithSupplier } from './purchases.interfaces';

export function toPurchaseResponse(p: PurchaseWithSupplier): PurchaseResponse {
  const supplier = p.supplierId;
  const paidPaise = p.cashPaidPaise + p.onlinePaidPaise;
  return {
    id: p._id.toString(),
    supplierId: supplier?._id.toString() ?? '',
    supplier: supplier ? { id: supplier._id.toString(), ownerName: supplier.ownerName ?? '', phone: supplier.phone ?? '' } : null,
    purchaseDate: formatDateOnly(p.purchaseDate),
    weight: gramsToKg(p.weightGrams),
    rate: paiseToRupees(p.ratePaise),
    totalAmount: paiseToRupees(p.totalPaise),
    cashPaid: paiseToRupees(p.cashPaidPaise),
    onlinePaid: paiseToRupees(p.onlinePaidPaise),
    remaining: paiseToRupees(p.totalPaise - paidPaise),
    status: paymentStatus(p.totalPaise, paidPaise),
    notes: p.notes ?? '',
  };
}
