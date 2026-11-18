import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaymentMode } from '../../payments/payment.schema';
import { IsDateOnly, IsRupees } from '../../common/validators';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateSupplierPaymentDto {
  @IsRupees(0.01)
  amount: number;

  @IsEnum(PaymentMode, { message: 'Payment mode must be CASH or ONLINE' })
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

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  notes?: string;
}
