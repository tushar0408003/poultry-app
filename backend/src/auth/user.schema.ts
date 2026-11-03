import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ collection: 'users', timestamps: true })
export class User {
  _id: Types.ObjectId;

  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  username: string;

  /** bcrypt hash, never returned by the API. */
  @Prop({ required: true })
  passwordHash: string;

  /** Bumped on password change so older tokens stop working. */
  @Prop({ required: true, default: 0 })
  tokenVersion: number;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
