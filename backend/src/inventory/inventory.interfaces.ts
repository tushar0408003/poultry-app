import type { InventoryType } from './costing';
import type { Types } from 'mongoose';

export interface StockState {
  balanceGrams: number;
  balanceValuePaise: number;
  /** Last known average cost, paise per kg. 0 = no purchase yet. */
  avgRatePaisePerKg: number;
}

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

export interface MovementData {
  type: InventoryType;
  date: Date;
  sourceId?: Types.ObjectId | null;
  quantityGrams?: number;
  amountPaise?: number;
  countedGrams?: number | null;
  reason?: string;
}
