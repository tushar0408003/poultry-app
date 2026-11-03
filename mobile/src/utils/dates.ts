/**
 * Calendar dates travel as "YYYY-MM-DD" strings (same as the API). Conversions
 * to/from Date use the phone's local calendar, so "today" is the shop's today.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const pad = (n: number) => n.toString().padStart(2, '0');

export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local Date at noon (avoids DST edge cases) for a "YYYY-MM-DD" string. */
export function fromDateString(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export const todayString = () => toDateString(new Date());

export function addDaysString(s: string, days: number): string {
  const d = fromDateString(s);
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

export function addMonthsString(s: string, months: number): string {
  const d = fromDateString(s);
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  return toDateString(d);
}

/** "3 Nov 2026" */
export function formatDate(s: string): string {
  const d = fromDateString(s);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "Tue, 3 Nov" */
export function formatDateShort(s: string): string {
  const d = fromDateString(s);
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "Nov 2026" from "YYYY-MM" or "YYYY-MM-DD" */
export function formatMonth(s: string): string {
  const [y, m] = s.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** Short chart label: "3" for a day, "Nov" for a month bucket. */
export function chartLabel(label: string, granularity: 'day' | 'month'): string {
  if (granularity === 'month') return MONTHS[Number(label.slice(5, 7)) - 1];
  return String(Number(label.slice(8, 10)));
}

export function friendlyDate(s: string): string {
  const today = todayString();
  if (s === today) return 'Today';
  if (s === addDaysString(today, -1)) return 'Yesterday';
  return formatDate(s);
}
