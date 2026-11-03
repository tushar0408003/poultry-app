/**
 * Client-side money math mirrors the backend (backend/src/common/money.ts):
 * amounts are integers in paise, weights integers in grams, so the live totals
 * shown while typing are exactly what the server will store.
 */

/** Parses "12.5" -> 1250 (scale 2). Returns null for empty/invalid/too precise input. */
export function parseDecimal(text: string, scale: number): number | null {
  const m = /^(\d+)(?:\.(\d*))?$/.exec(text.trim());
  if (!m) return null;
  const frac = (m[2] ?? '').replace(/0+$/, '');
  if (frac.length > scale) return null;
  const value = Number(m[1] + frac.padEnd(scale, '0'));
  return Number.isSafeInteger(value) ? value : null;
}

export const toPaise = (text: string) => parseDecimal(text, 2);
export const toGrams = (text: string) => parseDecimal(text, 3);

/** grams x paise-per-kg / 1000, rounded half-up to a paisa. */
export function saleAmountPaise(grams: number, ratePaise: number): number {
  const product = BigInt(grams) * BigInt(ratePaise);
  return Number((product * 2n + 1000n) / 2000n);
}

/** Indian digit grouping: 1234567 -> "12,34,567". */
function groupIndian(intDigits: string): string {
  if (intDigits.length <= 3) return intDigits;
  const last3 = intDigits.slice(-3);
  const rest = intDigits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
}

/**
 * Formats rupees as "₹12,34,567" or "₹1,234.50".
 * Implemented by hand so it does not depend on the device's Intl support.
 */
export function formatINR(rupees: number, opts: { decimals?: 'auto' | 'always' } = {}): string {
  const paise = Math.round(rupees * 100);
  const negative = paise < 0;
  const abs = Math.abs(paise);
  const int = Math.floor(abs / 100).toString();
  const frac = (abs % 100).toString().padStart(2, '0');
  const showFrac = opts.decimals === 'always' || frac !== '00';
  return `${negative ? '-' : ''}₹${groupIndian(int)}${showFrac ? `.${frac}` : ''}`;
}

export const paiseToINR = (paise: number) => formatINR(paise / 100);

/** "1,250.5 kg" */
export function formatKg(kg: number): string {
  const grams = Math.round(kg * 1000);
  const int = Math.floor(Math.abs(grams) / 1000).toString();
  const frac = (Math.abs(grams) % 1000).toString().padStart(3, '0').replace(/0+$/, '');
  return `${grams < 0 ? '-' : ''}${groupIndian(int)}${frac ? `.${frac}` : ''} kg`;
}

/** Number -> plain input string ("200", "12.5"), for pre-filling edit forms. */
export function toInputString(value: number): string {
  return value === 0 ? '' : String(value);
}
