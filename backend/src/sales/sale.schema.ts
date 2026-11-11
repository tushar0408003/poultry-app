import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Customer } from '../customers/customer.schema';

const intValidator = { validator: Number.isSafeInteger, message: '{PATH} must be an integer' };

/**
 * One sale. All money is in integer PAISE, weight in integer GRAMS (see common/money.ts).
 *
 * cashPaid / onlinePaid / totalPaid / remaining (paise, despite the names) are a cache
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

  @Prop({ required: true, min: 1, validate: intValidator })
  weightGrams: number;

  @Prop({ required: true, min: 1, validate: intValidator })
  ratePaise: number;

  @Prop({ required: true, min: 0, validate: intValidator })
  totalAmountPaise: number;

  @Prop({ required: true, min: 0, default: 0, validate: intValidator })
  cashPaid: number;

  @Prop({ required: true, min: 0, default: 0, validate: intValidator })
  onlinePaid: number;

  @Prop({ required: true, min: 0, default: 0, validate: intValidator })
  totalPaid: number;

  @Prop({ required: true, min: 0, validate: intValidator })
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
