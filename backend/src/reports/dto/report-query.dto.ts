import { IsOptional } from 'class-validator';
import { IsDateOnly } from '../../common/validators';

export class DateQueryDto {
  /** Any date inside the wanted day/week/month. Defaults to today. */
  @IsOptional()
  @IsDateOnly()
  date?: string;
}

export class CustomRangeQueryDto {
  @IsDateOnly()
  from: string;

  /** Inclusive. */
  @IsDateOnly()
  to: string;
}
