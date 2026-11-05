import { Controller, Get, Query } from '@nestjs/common';
import { Types } from 'mongoose';
import { AuditService } from './audit.service';
import { AuditQueryDto } from './dto/audit-query.dto';

@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  /** Change history, newest first. Filter by entity type and/or one record's id. */
  @Get()
  list(@Query() q: AuditQueryDto) {
    return this.audit.list(
      { entity: q.entity, entityId: q.entityId ? new Types.ObjectId(q.entityId) : undefined },
      q.page,
      q.limit,
    );
  }
}
