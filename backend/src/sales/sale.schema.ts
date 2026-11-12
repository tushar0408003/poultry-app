import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Customer } from '../customers/customer.schema';

/**
 * One sale, stored as entered: weight in kg, money in rupees (up to 2 decimals).
 * Arithmetic on these is done in integer paise (sale-ledger.service.ts), so a
 * fully paid sale has remaining exactly 0, never 1e-17.
 *
 * cashPaid / onlinePaid / totalPaid / remaining are a cache
 * derived from the `payments` collection (the source of truth). They are
 * recalculated inside the same transaction as every payment change.
 */
@Schema({ collection: 'sales', timestamps: true })
export class Sale {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Customer.name, required: true })
  customerId: Types.ObjectId;

  /** Calendar date at 00:00 UTC (see common/dates.ts). */
  @Prop({ required: true })
  saleDate: Date;

  /** Weight in kg, stored as entered (a double, not converted to grams). */
  @Prop({ required: true, min: 0.001 })
  weight: number;

  /** Entered by the user (total price); there is no per-kg rate. */
  @Prop({ required: true, min: 0.01 })
  totalAmount: number;

  @Prop({ required: true, min: 0, default: 0 })
  cashPaid: number;

  @Prop({ required: true, min: 0, default: 0 })
  onlinePaid: number;

  @Prop({ required: true, min: 0, default: 0 })
  totalPaid: number;

  @Prop({ required: true, min: 0 })
  remaining: number;

  @Prop({ trim: true, default: '', maxlength: 500 })
  notes: string;

  createdAt: Date;
  updatedAt: Date;
}

export type SaleDocument = HydratedDocument<Sale>;
export const SaleSchema = SchemaFactory.createForClass(Sale);
SaleSchema.index({ customerId: 1, saleDate: -1 });
SaleSchema.index({ saleDate: -1, createdAt: -1 });
SaleSchema.index({ remaining: 1 });
