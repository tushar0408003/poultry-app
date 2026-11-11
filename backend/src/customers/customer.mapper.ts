import { gramsToKg, paiseToRupees } from '../common/money';
import { formatDateOnly } from '../common/dates';
import type { Customer } from './customer.schema';
import type { CustomerSalesStats } from '../sales/sales.interfaces';
import type { CustomerResponse, CustomerStatsResponse } from './customers.interfaces';

export function toCustomerStats(stats?: CustomerSalesStats): CustomerStatsResponse {
  return {
    salesCount: stats?.count ?? 0,
    totalWeight: gramsToKg(stats?.weightGrams ?? 0),
    totalSales: paiseToRupees(stats?.totalAmountPaise ?? 0),
    totalPaid: paiseToRupees(stats?.totalPaidPaise ?? 0),
    outstandingBalance: paiseToRupees(stats?.remainingPaise ?? 0),
    lastSaleDate: stats?.lastSaleDate ? formatDateOnly(stats.lastSaleDate) : null,
  };
}

export function toCustomerResponse(c: Customer, stats?: CustomerSalesStats): CustomerResponse {
  return {
    id: c._id.toString(),
    shopName: c.shopName,
    ownerName: c.ownerName ?? '',
    phone: c.phone ?? '',
    address: c.address ?? '',
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    stats: toCustomerStats(stats),
  };
}
