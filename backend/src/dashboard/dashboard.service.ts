import { Injectable } from '@nestjs/common';
import { BusinessClock } from '../common/business-clock.service';
import { dayRange, formatDateOnly, monthRange, parseDateOnly, weekRange } from '../common/dates';
import { PaymentResponse, toPaymentResponse } from '../payments/payment.mapper';
import { PaymentsRepository } from '../payments/payments.repository';
import { CurrentOutstanding, PeriodSummary, ReportsService } from '../reports/reports.service';
import { SaleResponse, toSaleResponse } from '../sales/sale.mapper';
import { SalesRepository } from '../sales/sales.repository';

export interface DashboardSummary {
  date: string;
  isToday: boolean;
  day: {
    totalWeight: number;
    totalSales: number;
    salesCount: number;
    cashReceived: number;
    onlineReceived: number;
    totalReceived: number;
  };
  currentOutstanding: CurrentOutstanding;
  week: PeriodSummary;
  month: PeriodSummary;
  recentSales: SaleResponse[];
  recentPayments: PaymentResponse[];
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly reports: ReportsService,
    private readonly sales: SalesRepository,
    private readonly payments: PaymentsRepository,
    private readonly clock: BusinessClock,
  ) {}

  async summary(date?: string): Promise<DashboardSummary> {
    const day = date ? parseDateOnly(date) : this.clock.today();
    const [today, week, month, outstanding, recentSales, recentPayments] = await Promise.all([
      this.reports.summary(dayRange(day)),
      this.reports.summary(weekRange(day)),
      this.reports.summary(monthRange(day)),
      this.reports.currentOutstanding(),
      this.sales.recent(day, 8),
      this.payments.recent(day, 5),
    ]);
    return {
      date: formatDateOnly(day),
      isToday: day.getTime() === this.clock.today().getTime(),
      day: {
        totalWeight: today.sales.totalWeight,
        totalSales: today.sales.totalAmount,
        salesCount: today.sales.count,
        // "Received today" = payments dated today, including payments for older sales.
        cashReceived: today.collections.cash,
        onlineReceived: today.collections.online,
        totalReceived: today.collections.total,
      },
      currentOutstanding: outstanding,
      week,
      month,
      recentSales: recentSales.map(toSaleResponse),
      recentPayments: recentPayments.map(toPaymentResponse),
    };
  }
}
