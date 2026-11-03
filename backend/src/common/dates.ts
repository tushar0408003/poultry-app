/**
 * Calendar-date handling.
 *
 * Sale and payment dates are business *calendar dates* (no time of day). They are
 * exchanged as "YYYY-MM-DD" strings and stored as a Date at 00:00 UTC of that
 * calendar day. Because the stored value never depends on a timezone, a sale made
 * on 3 Nov is always reported on 3 Nov, wherever the server runs.
 *
 * The only timezone-dependent question is "what is today?", answered in the
 * business timezone (IST by default, configurable via BUSINESS_TZ_OFFSET_MINUTES).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export type PeriodKind = 'day' | 'week' | 'month' | 'custom';

export interface DateRange {
  /** inclusive, 00:00 UTC of the first day */
  from: Date;
  /** exclusive, 00:00 UTC of the day after the last day */
  toExclusive: Date;
}

export function isValidDateOnly(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

export function parseDateOnly(value: string): Date {
  if (!isValidDateOnly(value)) throw new RangeError(`Invalid date "${value}", expected YYYY-MM-DD`);
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Today's calendar date in the business timezone, as 00:00 UTC of that date. */
export function todayInBusinessTz(offsetMinutes: number, now: Date = new Date()): Date {
  const local = new Date(now.getTime() + offsetMinutes * 60 * 1000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}

export function dayRange(day: Date): DateRange {
  return { from: day, toExclusive: addDays(day, 1) };
}

/** Monday-to-Sunday week containing `day`. */
export function weekRange(day: Date): DateRange {
  const isoDow = (day.getUTCDay() + 6) % 7; // Monday = 0
  const from = addDays(day, -isoDow);
  return { from, toExclusive: addDays(from, 7) };
}

export function monthRange(day: Date): DateRange {
  const from = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1));
  const toExclusive = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 1));
  return { from, toExclusive };
}

/** Inclusive from/to calendar dates -> range. */
export function customRange(from: Date, to: Date): DateRange {
  if (to < from) throw new RangeError('"to" must be on or after "from"');
  return { from, toExclusive: addDays(to, 1) };
}

export function rangeDays(range: DateRange): number {
  return Math.round((range.toExclusive.getTime() - range.from.getTime()) / DAY_MS);
}

/**
 * The period immediately before `range`, used for "compared with previous period".
 * Calendar months compare with the previous calendar month; other ranges with
 * the same number of days immediately before.
 */
export function previousRange(range: DateRange, kind: PeriodKind): DateRange {
  if (kind === 'month') return monthRange(addDays(range.from, -1));
  const days = rangeDays(range);
  return { from: addDays(range.from, -days), toExclusive: range.from };
}

export function lastDayOf(range: DateRange): Date {
  return addDays(range.toExclusive, -1);
}
