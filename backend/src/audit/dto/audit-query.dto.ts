import { IsIn, IsMongoId, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.dto';
import { AUDIT_ENTITIES, type AuditEntity } from '../audit-log.schema';

export class AuditQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(AUDIT_ENTITIES)
  entity?: AuditEntity;

  @IsOptional()
  @IsMongoId()
  entityId?: string;
}
