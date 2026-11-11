import type { AuditAction, AuditEntity } from './audit-log.schema';
import type { Types } from 'mongoose';

export interface AuditEntry {
  entity: AuditEntity;
  entityId: Types.ObjectId;
  action: AuditAction;
  before?: object | null;
  after?: object | null;
}

export interface AuditLogResponse {
  id: string;
  entity: AuditEntity;
  entityId: string;
  action: AuditAction;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  /** Fields whose stored value differs between before and after. */
  changedFields: string[];
  username: string;
  at: Date;
}
