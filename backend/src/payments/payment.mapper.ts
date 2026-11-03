import { Types } from 'mongoose';
import { formatDateOnly } from '../common/dates';
import { paiseToRupees } from '../common/money';
import { CustomerSummary, toCustomerSummary } from '../sales/sale.mapper';
import type { CustomerRef } from '../sales/sales.repository';
import type { Payment, PaymentMode, PaymentSource } from './payment.schema';
import type { PaymentWithCustomer } from './payments.repository';

export interface PaymentResponse {
  id: string;
  saleId: string;
  customerId: string;
  customer: CustomerSummary | null;
  amount: number;
  paymentMode: PaymentMode;
  paymentDate: string;
  transactionReference: string;
  source: PaymentSource;
  createdAt: Date;
}

export function toPaymentResponse(p: Payment | PaymentWithCustomer): PaymentResponse {
  const ref = p.customerId as CustomerRef | Types.ObjectId | null;
  const customerId = !ref ? '' : ref instanceof Types.ObjectId ? ref.toString() : ref._id.toString();
  return {
    id: p._id.toString(),
    saleId: p.saleId.toString(),
    customerId,
    customer: toCustomerSummary(ref),
    amount: paiseToRupees(p.amountPaise),
    paymentMode: p.paymentMode,
    paymentDate: formatDateOnly(p.paymentDate),
    transactionReference: p.transactionReference ?? '',
    source: p.source,
    createdAt: p.createdAt,
  };
}
