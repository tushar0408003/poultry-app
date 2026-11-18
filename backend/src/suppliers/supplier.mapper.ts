import { formatDateOnly } from '../common/dates';
import { gramsToKg, paiseToRupees } from '../common/money';
import type { SupplierPurchaseStats } from '../purchases/purchases.interfaces';
import type { SupplierPayment } from './supplier-payment.schema';
import type { SupplierPaymentTotals } from './supplier-payments.repository';
import type { Supplier } from './supplier.schema';
import type { SupplierPaymentResponse, SupplierResponse, SupplierStatsResponse } from './suppliers.interfaces';

/** Balance owed to the supplier, in paise. Negative = advance paid. */
export function supplierBalancePaise(outstandingPaise: number, stats?: SupplierPurchaseStats, payments?: SupplierPaymentTotals): number {
  return outstandingPaise + (stats?.totalPaise ?? 0) - (stats?.paidPaise ?? 0) - (payments?.totalPaise ?? 0);
}

export function toSupplierStats(
  outstandingPaise: number,
  stats?: SupplierPurchaseStats,
  payments?: SupplierPaymentTotals,
): SupplierStatsResponse {
  const paidAtPurchasePaise = stats?.paidPaise ?? 0;
  const laterPaise = payments?.totalPaise ?? 0;
  return {
    purchasesCount: stats?.count ?? 0,
    weight: gramsToKg(stats?.weightGrams ?? 0),
    purchases: paiseToRupees(stats?.totalPaise ?? 0),
    paidAtPurchase: paiseToRupees(paidAtPurchasePaise),
    payments: paiseToRupees(laterPaise),
    paymentsCount: payments?.count ?? 0,
    paid: paiseToRupees(paidAtPurchasePaise + laterPaise),
    balance: paiseToRupees(supplierBalancePaise(outstandingPaise, stats, payments)),
  };
}

export function toSupplierResponse(s: Supplier, stats?: SupplierPurchaseStats, payments?: SupplierPaymentTotals): SupplierResponse {
  return {
    id: s._id.toString(),
    ownerName: s.ownerName ?? '',
    phone: s.phone ?? '',
    address: s.address ?? '',
    outstanding: paiseToRupees(s.outstandingPaise ?? 0),
    rate: paiseToRupees(s.ratePaise ?? 0),
    weight: gramsToKg(s.weightGrams ?? 0),
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    stats: toSupplierStats(s.outstandingPaise ?? 0, stats, payments),
  };
}

export function toSupplierPaymentResponse(p: SupplierPayment): SupplierPaymentResponse {
  return {
    id: p._id.toString(),
    supplierId: p.supplierId.toString(),
    paymentDate: formatDateOnly(p.paymentDate),
    amount: paiseToRupees(p.amountPaise),
    paymentMode: p.paymentMode,
    transactionReference: p.transactionReference ?? '',
    notes: p.notes ?? '',
  };
}
