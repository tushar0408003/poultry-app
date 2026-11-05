import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

export const AUDIT_ENTITIES = ['customer', 'supplier', 'purchase', 'sale', 'payment', 'expense', 'stock', 'settings'] as const;
export type AuditEntity = (typeof AUDIT_ENTITIES)[number];

/** Append-only record of every important change, written in the same transaction as the change. */
@Schema({ collection: 'auditLogs', timestamps: { createdAt: 'at', updatedAt: false } })
export class AuditLog {
  _id: Types.ObjectId;

  @Prop({ required: true, enum: AUDIT_ENTITIES, type: String })
  entity: AuditEntity;

  @Prop({ type: Types.ObjectId, required: true })
  entityId: Types.ObjectId;

  @Prop({ required: true, enum: AuditAction, type: String })
  action: AuditAction;

  /** Stored snapshot before the change (null for CREATE), in stored units (paise / grams). */
  @Prop({ type: Object, default: null })
  before: Record<string, unknown> | null;

  /** Stored snapshot after the change (null for DELETE). */
  @Prop({ type: Object, default: null })
  after: Record<string, unknown> | null;

  @Prop({ type: String, default: null })
  userId: string | null;

  @Prop({ type: String, default: 'system' })
  username: string;

  at: Date;
}

export type AuditLogDocument = HydratedDocument<AuditLog>;
export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
AuditLogSchema.index({ entity: 1, entityId: 1, at: -1 });
AuditLogSchema.index({ at: -1 });
