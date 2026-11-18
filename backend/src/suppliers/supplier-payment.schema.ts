import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { PaymentMode } from '../payments/payment.schema';
import { Supplier } from './supplier.schema';

/**
 * Money paid to a supplier against their balance (not tied to one purchase).
 * Amounts paid while entering a purchase stay on the purchase itself.
 */
@Schema({ collection: 'supplierPayments', timestamps: true })
export class SupplierPayment {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Supplier.name, required: true })
  supplierId: Types.ObjectId;

  /** Calendar date at 00:00 UTC (see common/dates.ts). */
  @Prop({ required: true })
  paymentDate: Date;

  @Prop({ required: true, min: 1, validate: { validator: Number.isSafeInteger } })
  amountPaise: number;

  @Prop({ required: true, enum: PaymentMode, type: String })
  paymentMode: PaymentMode;

  @Prop({ trim: true, default: '', maxlength: 100 })
  transactionReference: string;

  @Prop({ trim: true, default: '', maxlength: 500 })
  notes: string;

  createdAt: Date;
  updatedAt: Date;
}

export type SupplierPaymentDocument = HydratedDocument<SupplierPayment>;
export const SupplierPaymentSchema = SchemaFactory.createForClass(SupplierPayment);
SupplierPaymentSchema.index({ supplierId: 1, paymentDate: -1 });
