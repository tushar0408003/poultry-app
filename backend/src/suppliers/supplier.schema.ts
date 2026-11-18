import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ collection: 'suppliers', timestamps: true })
export class Supplier {
  _id: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 120 })
  ownerName: string;

  @Prop({ trim: true, default: '', maxlength: 20 })
  phone: string;

  @Prop({ trim: true, default: '', maxlength: 300 })
  address: string;

  /** Dues owed to the supplier from before the app, integer paise. */
  @Prop({ min: 0, default: 0, validate: { validator: Number.isSafeInteger } })
  outstandingPaise: number;

  /** Agreed purchase rate per kg, integer paise. */
  @Prop({ min: 0, default: 0, validate: { validator: Number.isSafeInteger } })
  ratePaise: number;

  /** Weight entered on the supplier, integer grams (0 if not set). */
  @Prop({ min: 0, default: 0, validate: { validator: Number.isSafeInteger } })
  weightGrams: number;

  createdAt: Date;
  updatedAt: Date;
}

export type SupplierDocument = HydratedDocument<Supplier>;
export const SupplierSchema = SchemaFactory.createForClass(Supplier);
SupplierSchema.index({ ownerName: 1 });
