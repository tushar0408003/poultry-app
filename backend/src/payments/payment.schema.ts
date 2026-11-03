import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Customer } from '../customers/customer.schema';
import { Sale } from '../sales/sale.schema';

export enum PaymentMode {
  CASH = 'CASH',
  ONLINE = 'ONLINE',
}

/**
 * SALE_ENTRY  - money received while the sale was entered (cash/online fields
 *               on the Add Sale form). Its date always equals the sale date.
 * COLLECTION  - a later payment against an existing sale.
 */
export enum PaymentSource {
  SALE_ENTRY = 'SALE_ENTRY',
  COLLECTION = 'COLLECTION',
}

@Schema({ collection: 'payments', timestamps: { createdAt: true, updatedAt: false } })
export class Payment {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Sale.name, required: true })
  saleId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Customer.name, required: true })
  customerId: Types.ObjectId;

  /** Integer paise, always > 0. */
  @Prop({ required: true, min: 1, validate: { validator: Number.isSafeInteger } })
  amountPaise: number;

  @Prop({ required: true, enum: PaymentMode, type: String })
  paymentMode: PaymentMode;

  /** Calendar date at 00:00 UTC. Collection reports are grouped by this date. */
  @Prop({ required: true })
  paymentDate: Date;

  @Prop({ trim: true, default: '', maxlength: 100 })
  transactionReference: string;

  @Prop({ required: true, enum: PaymentSource, type: String, default: PaymentSource.COLLECTION })
  source: PaymentSource;

  createdAt: Date;
}

export type PaymentDocument = HydratedDocument<Payment>;
export const PaymentSchema = SchemaFactory.createForClass(Payment);
PaymentSchema.index({ saleId: 1 });
PaymentSchema.index({ customerId: 1, paymentDate: -1 });
PaymentSchema.index({ paymentDate: -1, createdAt: -1 });
