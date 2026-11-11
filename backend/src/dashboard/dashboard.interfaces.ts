import type { PaymentResponse } from '../payments/payments.interfaces';
import type { CurrentOutstanding, PeriodSummary } from '../reports/reports.interfaces';
import type { SaleResponse } from '../sales/sales.interfaces';


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
