import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';

/** AuditService itself is provided globally by DatabaseModule so every module can record changes. */
@Module({ controllers: [AuditController] })
export class AuditModule {}
