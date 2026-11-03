/**
 * Decimal-safe money & weight handling.
 *
 * Strategy: every amount is stored and calculated as an INTEGER in minor units
 *   - money  -> paise  (1 rupee = 100 paise)
 *   - weight -> grams  (1 kg    = 1000 grams)
 *
 * Integers are exact in IEEE-754 doubles up to 2^53 (~9 x 10^15 paise, i.e.
 * ~₹90 trillion), so additions/subtractions and MongoDB $sum aggregations are
 * exact. The only multiplication (weight x rate) is done with BigInt and rounded
 * half-up to the nearest paisa. Decimal input is parsed from its string form, so
 * values like 1.005 never pass through a lossy `x * 100`.
 */

export const PAISE_PER_RUPEE = 100;
export const GRAMS_PER_KG = 1000;

export class DecimalFormatError extends Error {}

/**
 * Parse a decimal number/string into integer minor units with at most `scale`
 * fraction digits. Throws DecimalFormatError on bad input or excess precision.
 *   parseDecimal('12.5', 2)  -> 1250
 *   parseDecimal(0.125, 3)   -> 125
 */
export function parseDecimal(value: number | string, scale: number): number {
  const text = typeof value === 'number' ? numberToPlainString(value) : value.trim();
  const match = /^(-)?(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) throw new DecimalFormatError(`"${value}" is not a valid number`);
  const [, sign, intPart, fracRaw = ''] = match;
  const frac = fracRaw.replace(/0+$/, '');
  if (frac.length > scale) {
    throw new DecimalFormatError(`"${value}" has more than ${scale} decimal places`);
  }
  const minor = BigInt(intPart + frac.padEnd(scale, '0'));
  const result = Number(sign ? -minor : minor);
  if (!Number.isSafeInteger(result)) throw new DecimalFormatError(`"${value}" is too large`);
  return result;
}

function numberToPlainString(value: number): string {
  if (!Number.isFinite(value)) throw new DecimalFormatError(`${value} is not a finite number`);
  // Number#toString gives the shortest round-trip representation (1.005 -> "1.005"),
  // but switches to exponent notation for very small/large values.
  const s = value.toString();
  if (!/e/i.test(s)) return s;
  return value.toFixed(20).replace(/\.?0+$/, '');
}

export const rupeesToPaise = (v: number | string) => parseDecimal(v, 2);
export const kgToGrams = (v: number | string) => parseDecimal(v, 3);

/** Integer minor units -> major units for JSON output. */
export const paiseToRupees = (paise: number): number => paise / PAISE_PER_RUPEE;
export const gramsToKg = (grams: number): number => grams / GRAMS_PER_KG;

/**
 * totalAmount = weight x ratePerKg, computed exactly and rounded half-up to 1 paisa.
 *   grams * paisePerKg / 1000 = paise
 */
export function computeSaleAmount(weightGrams: number, ratePaisePerKg: number): number {
  if (weightGrams < 0 || ratePaisePerKg < 0) throw new RangeError('weight and rate must be >= 0');
  const product = BigInt(weightGrams) * BigInt(ratePaisePerKg);
  const divisor = BigInt(GRAMS_PER_KG);
  const rounded = (product * 2n + divisor) / (divisor * 2n); // half-up for non-negative values
  const result = Number(rounded);
  if (!Number.isSafeInteger(result)) throw new RangeError('sale amount is too large');
  return result;
}

/** "₹12,34,567.5" style formatting for error messages. */
export function formatInr(paise: number): string {
  return `₹${(paise / PAISE_PER_RUPEE).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export type PaymentStatus = 'PAID' | 'PARTIAL' | 'UNPAID';
export const PAYMENT_STATUSES: PaymentStatus[] = ['PAID', 'PARTIAL', 'UNPAID'];

export function paymentStatus(totalPaise: number, paidPaise: number): PaymentStatus {
  if (paidPaise >= totalPaise) return 'PAID';
  if (paidPaise <= 0) return 'UNPAID';
  return 'PARTIAL';
}
