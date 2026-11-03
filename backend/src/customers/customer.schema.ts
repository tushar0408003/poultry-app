import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ collection: 'customers', timestamps: true })
export class Customer {
  _id: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 120 })
  shopName: string;

  /** Normalised shop name (lower-case, single spaces) used to prevent duplicates. */
  @Prop({ required: true, unique: true })
  shopNameKey: string;

  @Prop({ trim: true, default: '', maxlength: 120 })
  ownerName: string;

  @Prop({ trim: true, default: '', maxlength: 20 })
  phone: string;

  @Prop({ trim: true, default: '', maxlength: 300 })
  address: string;

  createdAt: Date;
  updatedAt: Date;
}

export type CustomerDocument = HydratedDocument<Customer>;
export const CustomerSchema = SchemaFactory.createForClass(Customer);
CustomerSchema.index({ shopName: 1 });

export function normaliseShopName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}
