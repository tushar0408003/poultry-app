import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { setupApp } from './setup-app';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Render's proxy sits in front: use the client's real IP so login throttling is per device, not shared by everyone.
  app.set('trust proxy', 1);
  const config = app.get(ConfigService);

  setupApp(app);
  const origins = config.get<string>('CORS_ORIGINS', '*');
  app.enableCors({ origin: origins === '*' ? true : origins.split(',').map((o) => o.trim()) });
  app.enableShutdownHooks();

  const port = config.get<number>('PORT', 3000);
  // 0.0.0.0 so a phone on the same Wi-Fi can reach the API during development.
  await app.listen(port, '0.0.0.0');
  Logger.log(`API listening on http://0.0.0.0:${port}`, 'Bootstrap');
}

void bootstrap();
