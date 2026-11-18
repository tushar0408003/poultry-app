import type { PeriodKind } from '../common/dates';

export interface PeriodSummary {
  from: string;
  to: string;
  /** Sales whose SALE DATE falls in the period. */
  sales: {
    count: number;
    totalWeight: number;
    totalAmount: number;
    /** How much of this period's sales has been paid so far (on any date). */
    paidSoFar: number;
    /** How much of this period's sales is still unpaid today. */
    stillUnpaid: number;
  };
  /** Payments whose PAYMENT DATE falls in the period, for sales of any date. */
  collections: {
    count: number;
    cash: number;
    online: number;
    total: number;
  };
}

export interface CurrentOutstanding {
  /** Everything customers owe now: unpaid sales + unpaid old dues (matches the customer list total). */
  amount: number;
  customers: number;
  sales: number;
}

export interface SeriesPoint {
  label: string;
  weight: number;
  sales: number;
  cash: number;
  online: number;
  collected: number;
}

export interface Report extends PeriodSummary {
  kind: PeriodKind;
  currentOutstanding: CurrentOutstanding;
  previous: PeriodSummary;
  /** Percentage change vs previous period; null when the previous value was 0. */
  comparison: { totalWeight: number | null; totalSales: number | null; totalCollected: number | null };
  series: { granularity: 'day' | 'month'; points: SeriesPoint[] };
}
