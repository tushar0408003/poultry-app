import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { InventoryType } from './costing';

const int = { validator: Number.isSafeInteger, message: '{PATH} must be an integer' };

/**
 * One stock movement. Input columns are set by the owning record (purchase,
 * sale, loss entry or closing count); derived columns are recomputed by
 * InventoryLedger.replayFrom() whenever an earlier movement changes.
 * Weight in integer grams, money in integer paise.
 */
@Schema({ collection: 'inventoryTransactions', timestamps: true })
export class InventoryTransaction {
  _id: Types.ObjectId;

  @Prop({ required: true, enum: InventoryType, type: String })
  type: InventoryType;

  /** Sort key within a day (see TYPE_ORDER). */
  @Prop({ required: true, min: 1, max: 4 })
  typeOrder: number;

  /** Calendar date at 00:00 UTC: the transaction date of the owning record. */
  @Prop({ required: true })
  date: Date;

  /** The purchase / sale this movement belongs to. Empty for loss entries and counts. */
  @Prop({ type: Types.ObjectId, default: null })
  sourceId: Types.ObjectId | null;

  // ---- inputs ----
  @Prop({ required: true, min: 0, default: 0, validate: int })
  quantityGrams: number;

  @Prop({ required: true, min: 0, default: 0, validate: int })
  amountPaise: number;

  @Prop({ type: Number, min: 0, default: null })
  countedGrams: number | null;

  @Prop({ trim: true, default: '', maxlength: 300 })
  reason: string;

  // ---- derived (replay) ----
  @Prop({ required: true, default: 0, validate: int })
  deltaGrams: number;

  /** Signed change in stock value. SALE_OUT: −valuePaise = cost of goods sold. */
  @Prop({ required: true, default: 0, validate: int })
  valuePaise: number;

  @Prop({ required: true, default: 0, validate: int })
  balanceGrams: number;

  @Prop({ required: true, default: 0, validate: int })
  balanceValuePaise: number;

  @Prop({ required: true, default: 0, validate: int })
  avgRatePaisePerKg: number;

  createdAt: Date;
  updatedAt: Date;
}

export type InventoryTransactionDocument = HydratedDocument<InventoryTransaction>;
export const InventoryTransactionSchema = SchemaFactory.createForClass(InventoryTransaction);
InventoryTransactionSchema.index({ date: 1, typeOrder: 1, createdAt: 1, _id: 1 });
InventoryTransactionSchema.index({ type: 1, date: 1 });
InventoryTransactionSchema.index(
  { sourceId: 1 },
  { unique: true, partialFilterExpression: { sourceId: { $type: 'objectId' } } },
);
