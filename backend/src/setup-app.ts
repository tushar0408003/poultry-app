import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RequestContext } from './common/request-context';

/** Shared by main.ts and the e2e tests so both run with identical behaviour. */
export function setupApp(app: INestApplication): void {
  // Opens a per-request context (who is making the change) used by the audit log.
  app.use((_req: unknown, _res: unknown, next: () => void) => RequestContext.run(next));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
}
