import { Transform } from 'class-transformer';
import { IsIn, IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.dto';
import { PAYMENT_STATUSES, PaymentStatus } from '../../common/money';
import { IsDateOnly, IsKg, IsRupees } from '../../common/validators';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateSaleDto {
  @IsMongoId({ message: 'Please select a customer' })
  customerId: string;

  /** Defaults to today (business timezone). */
  @IsOptional()
  @IsDateOnly()
  saleDate?: string;

  @IsKg(0.001)
  weight: number;

  /** Total price of the sale in rupees. */
  @IsRupees(0.01)
  totalAmount: number;

  @IsOptional()
  @IsRupees(0)
  cashReceived?: number;

  @IsOptional()
  @IsRupees(0)
  onlineReceived?: number;

  /** UPI / bank reference for the online amount received with the sale. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  onlineReference?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  notes?: string;
}

/**
 * All fields optional. cashReceived / onlineReceived replace the amounts
 * received *at the time of sale*; later collections are managed via /payments.
 */
export class UpdateSaleDto {
  @IsOptional()
  @IsMongoId({ message: 'Please select a customer' })
  customerId?: string;

  @IsOptional()
  @IsDateOnly()
  saleDate?: string;

  @IsOptional()
  @IsKg(0.001)
  weight?: number;

  @IsOptional()
  @IsRupees(0.01)
  totalAmount?: number;

  @IsOptional()
  @IsRupees(0)
  cashReceived?: number;

  @IsOptional()
  @IsRupees(0)
  onlineReceived?: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  onlineReference?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ListSalesQueryDto extends PaginationQueryDto {
  /** Matches shop name, owner name or phone. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsMongoId()
  customerId?: string;

  /** Exact sale date. */
  @IsOptional()
  @IsDateOnly()
  date?: string;

  @IsOptional()
  @IsDateOnly()
  from?: string;

  @IsOptional()
  @IsDateOnly()
  to?: string;

  @IsOptional()
  @IsIn(PAYMENT_STATUSES)
  status?: PaymentStatus;
}
