import { plainToInstance, Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, MinLength, validateSync } from 'class-validator';

export class EnvironmentVariables {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  PORT: number = 3000;

  @IsString()
  @IsNotEmpty()
  MONGODB_URI: string;

  @IsString()
  @MinLength(16, { message: 'JWT_SECRET must be at least 16 characters long' })
  JWT_SECRET: string;

  @IsOptional()
  @IsString()
  JWT_EXPIRES_IN: string = '30d';

  @IsString()
  @IsNotEmpty()
  ADMIN_USERNAME: string;

  @IsString()
  @MinLength(8, { message: 'ADMIN_PASSWORD must be at least 8 characters long' })
  ADMIN_PASSWORD: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-720)
  @Max(840)
  BUSINESS_TZ_OFFSET_MINUTES: number = 330;

  @IsOptional()
  @IsString()
  CORS_ORIGINS: string = '*';
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, { enableImplicitConversion: false });
  const errors = validateSync(validated, { skipMissingProperties: false, whitelist: false });
  if (errors.length > 0) {
    const details = errors.flatMap((e) => Object.values(e.constraints ?? {})).join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  return validated;
}
