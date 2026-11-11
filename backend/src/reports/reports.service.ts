import { BadRequestException, Injectable } from '@nestjs/common';
import { BusinessClock } from '../common/business-clock.service';
import {
  addDays,
  customRange,
  DateRange,
  dayRange,
  formatDateOnly,
  lastDayOf,
  monthRange,
  parseDateOnly,
  PeriodKind,
  previousRange,
  rangeDays,
  weekRange,
} from '../common/dates';
import { gramsToKg, paiseToRupees } from '../common/money';
import { PaymentsRepository } from '../payments/payments.repository';
import { SalesRepository } from '../sales/sales.repository';
import type { CurrentOutstanding, PeriodSummary, Report, SeriesPoint } from './reports.interfaces';

const MAX_CUSTOM_DAYS = 731;
const MAX_DAILY_POINTS = 62;

@Injectable()
export class ReportsService {
  constructor(
    private readonly sales: SalesRepository,
    private readonly payments: PaymentsRepository,
    private readonly clock: BusinessClock,
  ) {}

  daily(date?: string): Promise<Report> {
    return this.build('day', dayRange(this.day(date)));
  }

  weekly(date?: string): Promise<Report> {
    return this.build('week', weekRange(this.day(date)));
  }

  monthly(date?: string): Promise<Report> {
    return this.build('month', monthRange(this.day(date)));
  }

  custom(from: string, to: string): Promise<Report> {
    let range: DateRange;
    try {
      range = customRange(parseDateOnly(from), parseDateOnly(to));
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    if (rangeDays(range) > MAX_CUSTOM_DAYS) {
      throw new BadRequestException(`Custom range cannot be longer than ${MAX_CUSTOM_DAYS} days`);
    }
    return this.build('custom', range);
  }

  async summary(range: DateRange): Promise<PeriodSummary> {
    const [sales, collections] = await Promise.all([
      this.sales.totalsForRange(range),
      this.payments.totalsForRange(range),
    ]);
    return {
      from: formatDateOnly(range.from),
      to: formatDateOnly(lastDayOf(range)),
      sales: {
        count: sales.count,
        totalWeight: gramsToKg(sales.weight),
        totalAmount: paiseToRupees(sales.totalAmount),
        paidSoFar: paiseToRupees(sales.totalPaid),
        stillUnpaid: paiseToRupees(sales.remaining),
      },
      collections: {
        count: collections.count,
        cash: paiseToRupees(collections.cashPaise),
        online: paiseToRupees(collections.onlinePaise),
        total: paiseToRupees(collections.cashPaise + collections.onlinePaise),
      },
    };
  }

  async currentOutstanding(): Promise<CurrentOutstanding> {
    const o = await this.sales.currentOutstanding();
    return { amount: paiseToRupees(o.remainingPaise), customers: o.customers, sales: o.sales };
  }

  private async build(kind: PeriodKind, range: DateRange): Promise<Report> {
    const [current, previous, outstanding, series] = await Promise.all([
      this.summary(range),
      this.summary(previousRange(range, kind)),
      this.currentOutstanding(),
      this.series(range),
    ]);
    return {
      kind,
      ...current,
      currentOutstanding: outstanding,
      previous,
      comparison: {
        totalWeight: pctChange(current.sales.totalWeight, previous.sales.totalWeight),
        totalSales: pctChange(current.sales.totalAmount, previous.sales.totalAmount),
        totalCollected: pctChange(current.collections.total, previous.collections.total),
      },
      series,
    };
  }

  private async series(range: DateRange): Promise<Report['series']> {
    const granularity = rangeDays(range) <= MAX_DAILY_POINTS ? 'day' : 'month';
    const format = granularity === 'day' ? '%Y-%m-%d' : '%Y-%m';
    const [salesBuckets, paymentBuckets] = await Promise.all([
      this.sales.series(range, format),
      this.payments.series(range, format),
    ]);
    const salesBy = new Map(salesBuckets.map((b) => [b._id, b]));
    const paymentsBy = new Map(paymentBuckets.map((b) => [b._id, b]));

    const points = bucketLabels(range, granularity).map((label): SeriesPoint => {
      const s = salesBy.get(label);
      const p = paymentsBy.get(label);
      const cashPaise = p?.cashPaise ?? 0;
      const onlinePaise = p?.onlinePaise ?? 0;
      return {
        label,
        weight: gramsToKg(s?.weightGrams ?? 0),
        sales: paiseToRupees(s?.totalAmountPaise ?? 0),
        cash: paiseToRupees(cashPaise),
        online: paiseToRupees(onlinePaise),
        collected: paiseToRupees(cashPaise + onlinePaise),
      };
    });
    return { granularity, points };
  }

  private day(date?: string): Date {
    return date ? parseDateOnly(date) : this.clock.today();
  }
}

export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function bucketLabels(range: DateRange, granularity: 'day' | 'month'): string[] {
  const labels: string[] = [];
  if (granularity === 'day') {
    for (let d = range.from; d < range.toExclusive; d = addDays(d, 1)) labels.push(formatDateOnly(d));
    return labels;
  }
  let d = monthRange(range.from).from;
  while (d < range.toExclusive) {
    labels.push(formatDateOnly(d).slice(0, 7));
    d = monthRange(d).toExclusive;
  }
  return labels;
}
