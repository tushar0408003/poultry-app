import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsRupees } from '../../common/validators';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class UpdateSettingsDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Business name cannot be empty' })
  @MaxLength(120)
  businessName?: string;

  /** Pre-filled purchase price per KG (₹). 0 = none. */
  @IsOptional()
  @IsRupees(0)
  defaultPurchaseRate?: number;

  /** Pre-filled selling price per KG (₹). 0 = none. */
  @IsOptional()
  @IsRupees(0)
  defaultSaleRate?: number;
}
