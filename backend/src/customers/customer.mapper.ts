import { gramsToKg, paiseToRupees } from '../common/money';
import { formatDateOnly } from '../common/dates';
import type { Customer } from './customer.schema';
import type { CustomerSalesStats } from '../sales/sales.interfaces';
import type { CustomerPaymentStats } from '../payments/payments.interfaces';
import type { CustomerResponse, CustomerStatsResponse } from './customers.interfaces';

export function toCustomerStats(
  outstandingPaise: number,
  stats?: CustomerSalesStats,
  payments?: CustomerPaymentStats,
): CustomerStatsResponse {
  const totalPaise = outstandingPaise + (stats?.totalAmount ?? 0);
  // Sale caches cover sale payments; `payments` adds the ones against outstanding.
  const onlinePaise = (stats?.onlinePaidPaise ?? 0) + (payments?.onlinePaise ?? 0);
  const offlinePaise = (stats?.cashPaidPaise ?? 0) + (payments?.cashPaise ?? 0);
  return {
    salesCount: stats?.count ?? 0,
    weight: gramsToKg(stats?.weight ?? 0),
    sales: paiseToRupees(stats?.totalAmount ?? 0),
    total: paiseToRupees(totalPaise),
    onlinePayment: paiseToRupees(onlinePaise),
    offlinePayment: paiseToRupees(offlinePaise),
    outstandingBalance: paiseToRupees(totalPaise - onlinePaise - offlinePaise),
    lastPaymentDate: payments?.lastPaymentDate ? formatDateOnly(payments.lastPaymentDate) : null,
  };
}

export function toCustomerResponse(
  c: Customer,
  stats?: CustomerSalesStats,
  payments?: CustomerPaymentStats,
): CustomerResponse {
  return {
    id: c._id.toString(),
    ownerName: c.ownerName ?? '',
    phone: c.phone ?? '',
    address: c.address ?? '',
    outstanding: paiseToRupees(c.outstandingPaise ?? 0),
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    stats: toCustomerStats(c.outstandingPaise ?? 0, stats, payments),
  };
}
