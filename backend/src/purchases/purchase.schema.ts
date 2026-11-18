import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Supplier } from '../suppliers/supplier.schema';

const int = { validator: Number.isSafeInteger, message: '{PATH} must be an integer' };

/**
 * One purchase from a supplier. Weight in integer grams, money in integer paise.
 * `ratePaise` is a snapshot of the rate used, so later changes to the supplier's
 * rate do not change old purchases.
 */
@Schema({ collection: 'purchases', timestamps: true })
export class Purchase {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Supplier.name, required: true })
  supplierId: Types.ObjectId;

  /** Calendar date at 00:00 UTC (see common/dates.ts). */
  @Prop({ required: true })
  purchaseDate: Date;

  @Prop({ required: true, min: 1, validate: int })
  weightGrams: number;

  /** Rate per kg used for this purchase. */
  @Prop({ required: true, min: 1, validate: int })
  ratePaise: number;

  /** weight x rate, rounded to the paisa. */
  @Prop({ required: true, min: 1, validate: int })
  totalPaise: number;

  @Prop({ required: true, min: 0, default: 0, validate: int })
  cashPaidPaise: number;

  @Prop({ required: true, min: 0, default: 0, validate: int })
  onlinePaidPaise: number;

  @Prop({ trim: true, default: '', maxlength: 500 })
  notes: string;

  createdAt: Date;
  updatedAt: Date;
}

export type PurchaseDocument = HydratedDocument<Purchase>;
export const PurchaseSchema = SchemaFactory.createForClass(Purchase);
PurchaseSchema.index({ supplierId: 1, purchaseDate: -1 });
PurchaseSchema.index({ purchaseDate: -1, createdAt: -1 });
