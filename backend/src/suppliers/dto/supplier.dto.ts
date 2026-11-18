import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { IsKg, IsRupees } from '../../common/validators';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateSupplierDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Supplier name is required' })
  @MaxLength(120)
  ownerName: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(/^(\+?\d[\d\s-]{6,18}\d)?$/, { message: 'Phone number is not valid' })
  phone?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  address?: string;

  /** Dues owed to the supplier from before the app, in rupees (0 if none). */
  @IsRupees(0)
  outstanding: number;

  /** Rate per kg, in rupees. */
  @IsRupees(0)
  rate: number;

  /** Weight in kg (optional, 0 if not set). */
  @IsOptional()
  @IsKg(0)
  weight?: number;
}

export class UpdateSupplierDto extends PartialType(CreateSupplierDto) {}

export class ListSuppliersQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
