import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export const SETTINGS_KEY = 'app';

const int = { validator: Number.isSafeInteger, message: '{PATH} must be an integer' };

/**
 * Single application-settings document. Default rates only PRE-FILL forms;
 * every purchase and sale stores its own rate, so changing these never alters history.
 */
@Schema({ collection: 'settings', timestamps: true })
export class Settings {
  _id: Types.ObjectId;

  @Prop({ required: true, unique: true, default: SETTINGS_KEY })
  key: string;

  @Prop({ trim: true, default: 'My Poultry Business', maxlength: 120 })
  businessName: string;

  /** 0 = no default. */
  @Prop({ required: true, min: 0, default: 0, validate: int })
  defaultPurchaseRatePaise: number;

  @Prop({ required: true, min: 0, default: 0, validate: int })
  defaultSaleRatePaise: number;

  createdAt: Date;
  updatedAt: Date;
}

export type SettingsDocument = HydratedDocument<Settings>;
export const SettingsSchema = SchemaFactory.createForClass(Settings);
