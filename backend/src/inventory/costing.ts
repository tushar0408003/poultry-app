/**
 * Weighted-average inventory costing (pure functions, no I/O).
 *
 * Stock is tracked by quantity (integer grams) AND total value (integer paise).
 * Outgoing stock takes a proportional share of the value, so the moving average
 * never accumulates rounding drift, and over time:
 *
 *     Σ purchases = Σ cost of goods sold + Σ weight-loss cost + closing stock value
 *
 * Stock is allowed to go negative (inventory is for tracking only; a sale is never
 * blocked). While stock is not positive, outgoing weight is costed at the last
 * known average rate. A later purchase adds its full value, so the total cost is
 * still conserved.
 */

export enum InventoryType {
  PURCHASE_IN = 'PURCHASE_IN',
  SALE_OUT = 'SALE_OUT',
  LOSS = 'LOSS',
  STOCK_COUNT = 'STOCK_COUNT',
}

/** Order of events within one day: stock in, then sales, then losses, closing count last. */
export const TYPE_ORDER: Record<InventoryType, number> = {
  [InventoryType.PURCHASE_IN]: 1,
  [InventoryType.SALE_OUT]: 2,
  [InventoryType.LOSS]: 3,
  [InventoryType.STOCK_COUNT]: 4,
};

export interface StockState {
  balanceGrams: number;
  balanceValuePaise: number;
  /** Last known average cost, paise per kg. 0 = no purchase yet. */
  avgRatePaisePerKg: number;
}

export const EMPTY_STOCK: StockState = { balanceGrams: 0, balanceValuePaise: 0, avgRatePaisePerKg: 0 };

export interface MovementInput {
  type: InventoryType;
  /** PURCHASE_IN: received weight. SALE_OUT: sold weight. LOSS: lost weight. */
  quantityGrams?: number;
  /** PURCHASE_IN only: total purchase amount. */
  amountPaise?: number;
  /** STOCK_COUNT only: physically counted stock. */
  countedGrams?: number;
}

export interface MovementResult extends StockState {
  /** Signed change in stock quantity. */
  deltaGrams: number;
  /** Signed change in stock value. For SALE_OUT, −valuePaise is the cost of goods sold. */
  valuePaise: number;
}

/** Signed integer division rounded half away from zero. */
export function divRound(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new RangeError('division by zero');
  if (denominator < 0n) return divRound(-numerator, -denominator);
  const neg = numerator < 0n;
  const abs = neg ? -numerator : numerator;
  const q = (abs * 2n + denominator) / (denominator * 2n);
  return neg ? -q : q;
}

function toSafe(value: bigint): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) throw new RangeError('inventory value is too large');
  return n;
}

/** Value (paise) of `grams` taken out of the current stock. */
function costOut(state: StockState, grams: number): number {
  if (grams === 0) return 0;
  if (state.balanceGrams > 0 && state.balanceValuePaise > 0) {
    return toSafe(divRound(BigInt(state.balanceValuePaise) * BigInt(grams), BigInt(state.balanceGrams)));
  }
  return valueAtRate(grams, state.avgRatePaisePerKg);
}

function valueAtRate(grams: number, ratePaisePerKg: number): number {
  return toSafe(divRound(BigInt(grams) * BigInt(ratePaisePerKg), 1000n));
}

function assertNonNegativeInt(value: number | undefined, name: string): number {
  const v = value ?? 0;
  if (!Number.isSafeInteger(v) || v < 0) throw new RangeError(`${name} must be a non-negative integer`);
  return v;
}

export function applyMovement(state: StockState, input: MovementInput): MovementResult {
  let deltaGrams: number;
  let valuePaise: number;

  switch (input.type) {
    case InventoryType.PURCHASE_IN:
      deltaGrams = assertNonNegativeInt(input.quantityGrams, 'quantityGrams');
      valuePaise = assertNonNegativeInt(input.amountPaise, 'amountPaise');
      break;
    case InventoryType.SALE_OUT:
    case InventoryType.LOSS: {
      const grams = assertNonNegativeInt(input.quantityGrams, 'quantityGrams');
      deltaGrams = 0 - grams; // `0 - x`, not `-x`, so zero never becomes -0
      valuePaise = 0 - costOut(state, grams);
      break;
    }
    case InventoryType.STOCK_COUNT: {
      const counted = assertNonNegativeInt(input.countedGrams, 'countedGrams');
      deltaGrams = counted - state.balanceGrams;
      // Shortfall = loss at average cost; surplus = gain at the average rate.
      valuePaise = deltaGrams < 0 ? 0 - costOut(state, -deltaGrams) : valueAtRate(deltaGrams, state.avgRatePaisePerKg);
      break;
    }
    default:
      throw new RangeError(`Unknown inventory type ${String((input as MovementInput).type)}`);
  }

  const balanceGrams = state.balanceGrams + deltaGrams;
  const balanceValuePaise = state.balanceValuePaise + valuePaise;
  const avgRatePaisePerKg =
    balanceGrams > 0 && balanceValuePaise > 0
      ? toSafe(divRound(BigInt(balanceValuePaise) * 1000n, BigInt(balanceGrams)))
      : state.avgRatePaisePerKg;

  return { deltaGrams, valuePaise, balanceGrams, balanceValuePaise, avgRatePaisePerKg };
}

/** Applies movements in order, returning the computed result for each. */
export function replay(start: StockState, inputs: MovementInput[]): MovementResult[] {
  const results: MovementResult[] = [];
  let state = start;
  for (const input of inputs) {
    const result = applyMovement(state, input);
    results.push(result);
    state = result;
  }
  return results;
}
