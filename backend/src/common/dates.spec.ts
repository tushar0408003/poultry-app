import {
  customRange,
  DateRange,
  formatDateOnly,
  isValidDateOnly,
  monthRange,
  parseDateOnly,
  previousRange,
  todayInBusinessTz,
  weekRange,
} from './dates';

const d = parseDateOnly;
const fmt = (r: DateRange) => [formatDateOnly(r.from), formatDateOnly(r.toExclusive)];

describe('dates', () => {
  it('validates calendar dates', () => {
    expect(isValidDateOnly('2026-02-28')).toBe(true);
    expect(isValidDateOnly('2026-02-29')).toBe(false);
    expect(isValidDateOnly('2028-02-29')).toBe(true);
    expect(isValidDateOnly('2026-13-01')).toBe(false);
    expect(isValidDateOnly('2026-1-01')).toBe(false);
  });

  it('computes "today" in IST, not UTC', () => {
    // 20:00 UTC on 3 Nov is 01:30 IST on 4 Nov
    expect(formatDateOnly(todayInBusinessTz(330, new Date('2026-11-03T20:00:00Z')))).toBe('2026-11-04');
    expect(formatDateOnly(todayInBusinessTz(330, new Date('2026-11-03T18:29:00Z')))).toBe('2026-11-03');
  });

  it('builds Monday-Sunday weeks', () => {
    expect(fmt(weekRange(d('2026-11-03')))).toEqual(['2026-11-02', '2026-11-09']); // Tuesday
    expect(fmt(weekRange(d('2026-11-08')))).toEqual(['2026-11-02', '2026-11-09']); // Sunday
    expect(fmt(weekRange(d('2026-11-09')))).toEqual(['2026-11-09', '2026-11-16']); // Monday
  });

  it('builds calendar months and the previous month', () => {
    const march = monthRange(d('2026-03-15'));
    expect(fmt(march)).toEqual(['2026-03-01', '2026-04-01']);
    expect(fmt(previousRange(march, 'month'))).toEqual(['2026-02-01', '2026-03-01']);
  });

  it('builds a previous period of equal length for custom ranges', () => {
    const r = customRange(d('2026-11-01'), d('2026-11-10'));
    expect(fmt(r)).toEqual(['2026-11-01', '2026-11-11']);
    expect(fmt(previousRange(r, 'custom'))).toEqual(['2026-10-22', '2026-11-01']);
  });

  it('rejects inverted ranges', () => {
    expect(() => customRange(d('2026-11-10'), d('2026-11-01'))).toThrow();
  });
});
