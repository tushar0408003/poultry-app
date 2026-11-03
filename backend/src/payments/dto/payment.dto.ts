import { Transform } from 'class-transformer';
import { IsEnum, IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.dto';
import { IsDateOnly, IsRupees } from '../../common/validators';
import { PaymentMode } from '../payment.schema';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

class PaymentFieldsDto {
  @IsRupees(0.01)
  amount: number;

  @IsEnum(PaymentMode, { message: 'paymentMode must be CASH or ONLINE' })
  paymentMode: PaymentMode;

  /** Defaults to today (business timezone). */
  @IsOptional()
  @IsDateOnly()
  paymentDate?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  transactionReference?: string;
}

/** A payment against one specific sale. */
export class CreatePaymentDto extends PaymentFieldsDto {
  @IsMongoId()
  saleId: string;
}

/**
 * A lump-sum payment from a customer, split automatically across their
 * oldest unpaid sales first (FIFO). Creates one payment record per sale.
 */
export class AllocatePaymentDto extends PaymentFieldsDto {
  @IsMongoId()
  customerId: string;
}

export class ListPaymentsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsMongoId()
  customerId?: string;

  @IsOptional()
  @IsEnum(PaymentMode)
  paymentMode?: PaymentMode;

  @IsOptional()
  @IsDateOnly()
  date?: string;

  @IsOptional()
  @IsDateOnly()
  from?: string;

  @IsOptional()
  @IsDateOnly()
  to?: string;
}
