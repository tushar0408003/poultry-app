import { Controller, Get, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { InjectConnection, MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { Connection } from 'mongoose';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { Public } from './common/decorators/public.decorator';
import { validateEnv } from './config/env.validation';
import { CustomersModule } from './customers/customers.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DatabaseModule } from './database/database.module';
import { PaymentsModule } from './payments/payments.module';
import { ReportsModule } from './reports/reports.module';
import { SalesModule } from './sales/sales.module';
import { SettingsModule } from './settings/settings.module';

@Controller('health')
class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Public()
  @Get()
  health() {
    return { status: 'ok', database: this.connection.readyState === 1 ? 'connected' : 'disconnected' };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv, cache: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGODB_URI'),
        autoIndex: true,
        serverSelectionTimeoutMS: 10_000,
      }),
    }),
    // Generous global limit; the login route sets a much stricter one.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    DatabaseModule,
    AuthModule,
    CustomersModule,
    SalesModule,
    PaymentsModule,
    ReportsModule,
    DashboardModule,
    SettingsModule,
    AuditModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
