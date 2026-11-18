import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import { IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.dto';
import { IsDateOnly, IsKg, IsRupees } from '../../common/validators';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreatePurchaseDto {
  @IsMongoId({ message: 'Please select a supplier' })
  supplierId: string;

  /** Defaults to today (business timezone). */
  @IsOptional()
  @IsDateOnly()
  purchaseDate?: string;

  @IsKg(0.001)
  weight: number;

  /** Rate per kg in rupees. Defaults to the supplier's current rate. */
  @IsOptional()
  @IsRupees(0.01)
  rate?: number;

  @IsOptional()
  @IsRupees(0)
  cashPaid?: number;

  @IsOptional()
  @IsRupees(0)
  onlinePaid?: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  notes?: string;
}

/** All optional. Leaving out `rate` keeps the purchase's own rate (not the supplier's current one). */
export class UpdatePurchaseDto extends PartialType(CreatePurchaseDto) {}

export class ListPurchasesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsMongoId()
  supplierId?: string;
}
