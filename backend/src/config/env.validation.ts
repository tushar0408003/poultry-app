import { plainToInstance, Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, MinLength, validateSync } from 'class-validator';

const toBool = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const v = value.trim().toLowerCase();
  if (['true', '1', 'yes'].includes(v)) return true;
  if (['false', '0', 'no'].includes(v)) return false;
  return value; // rejected by @IsBoolean
};

export class EnvironmentVariables {
  @IsOptional()
  @IsIn(['development', 'production', 'test'])
  NODE_ENV: 'development' | 'production' | 'test' = 'development';

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

  /** Refuse to start unless MongoDB supports transactions (replica set). Defaults to on in production. */
  @IsOptional()
  @Transform(toBool)
  @IsBoolean({ message: 'REQUIRE_TRANSACTIONS must be true or false' })
  REQUIRE_TRANSACTIONS?: boolean;
}

export function isProduction(config: { get(key: string): unknown }): boolean {
  return config.get('NODE_ENV') === 'production';
}

/** Boolean env flag with an environment-dependent default. */
export function flag(config: { get(key: string): unknown }, key: string, fallback: boolean): boolean {
  const value = config.get(key);
  return typeof value === 'boolean' ? value : fallback;
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
