import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import { IsRupees } from '../../common/validators';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateCustomerDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Shop name is required' })
  @MaxLength(120)
  shopName: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  ownerName?: string;

  /** Optional so a new shop can be added from the sale form with just its name. */
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

  /** Dues carried over from before the app, in rupees. */
  @IsOptional()
  @IsRupees(0)
  outstanding?: number;
}

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {}

export class ListCustomersQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
