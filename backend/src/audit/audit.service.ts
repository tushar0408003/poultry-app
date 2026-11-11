import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model, QueryFilter, Types } from 'mongoose';
import { paginated, Paginated } from '../common/pagination.dto';
import { RequestContext } from '../common/request-context';
import { AuditEntity, AuditLog } from './audit-log.schema';
import type { AuditEntry, AuditLogResponse } from './audit.interfaces';

const IGNORED = new Set(['_id', '__v', 'createdAt', 'updatedAt']);

@Injectable()
export class AuditService {
  constructor(@InjectModel(AuditLog.name) private readonly model: Model<AuditLog>) {}

  /** Call inside the same transaction as the change being recorded. */
  async record(entry: AuditEntry, session?: ClientSession): Promise<void> {
    const user = RequestContext.user();
    await this.model.create(
      [
        {
          entity: entry.entity,
          entityId: entry.entityId,
          action: entry.action,
          before: snapshot(entry.before),
          after: snapshot(entry.after),
          userId: user?.id ?? null,
          username: user?.username ?? 'system',
        },
      ],
      { session },
    );
  }

  async list(
    filter: { entity?: AuditEntity; entityId?: Types.ObjectId },
    page: number,
    limit: number,
  ): Promise<Paginated<AuditLogResponse>> {
    const query: QueryFilter<AuditLog> = {};
    if (filter.entity) query.entity = filter.entity;
    if (filter.entityId) query.entityId = filter.entityId;
    const [items, total] = await Promise.all([
      this.model
        .find(query)
        .sort({ at: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<AuditLog[]>()
        .exec(),
      this.model.countDocuments(query).exec(),
    ]);
    return paginated(items.map(toResponse), total, page, limit);
  }
}

/** Plain JSON copy (ObjectIds -> strings, Dates -> ISO), so snapshots are stable and readable. */
function snapshot(value: object | null | undefined): Record<string, unknown> | null {
  if (!value) return null;
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

export function changedFields(before: Record<string, unknown> | null, after: Record<string, unknown> | null): string[] {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  return [...keys].filter((k) => !IGNORED.has(k) && JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k]));
}

function toResponse(log: AuditLog): AuditLogResponse {
  return {
    id: log._id.toString(),
    entity: log.entity,
    entityId: log.entityId.toString(),
    action: log.action,
    before: log.before,
    after: log.after,
    changedFields: changedFields(log.before, log.after),
    username: log.username,
    at: log.at,
  };
}
