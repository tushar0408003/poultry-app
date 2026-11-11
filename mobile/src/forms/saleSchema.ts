import { z } from 'zod';
import type { CustomerSummary, SaleInput } from '../api/types';
import { toGrams, toPaise } from '../utils/money';

const optionalAmount = z
  .string()
  .trim()
  .refine((v) => v === '' || toPaise(v) !== null, 'Enter a valid amount (up to 2 decimals)');

export const saleFormSchema = z
  .object({
    customer: z
      .custom<CustomerSummary | null>()
      .refine((c) => Boolean(c), 'Please select a customer'),
    saleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    weight: z
      .string()
      .trim()
      .min(1, 'Enter the weight')
      .refine((v) => (toGrams(v) ?? 0) > 0, 'Weight must be more than 0 (up to 3 decimals)'),
    totalAmount: z
      .string()
      .trim()
      .min(1, 'Enter the total price')
      .refine((v) => (toPaise(v) ?? 0) > 0, 'Total price must be more than 0 (up to 2 decimals)'),
    cashReceived: optionalAmount,
    onlineReceived: optionalAmount,
    onlineReference: z.string().trim().max(100),
    notes: z.string().trim().max(500, 'Notes are too long'),
    /** Payments collected after the sale (edit mode only), in paise. Not editable here. */
    laterPaymentsPaise: z.number().int().min(0),
  })
  .superRefine((v, ctx) => {
    const { totalPaise, paidPaise } = calculateSale(v);
    if (totalPaise > 0 && paidPaise > totalPaise) {
      ctx.addIssue({
        code: 'custom',
        path: ['cashReceived'],
        message: 'Total payment cannot be more than the sale amount',
      });
    }
  });

export type SaleFormValues = z.infer<typeof saleFormSchema>;

/** Live totals for the form, in paise. */
export function calculateSale(v: Pick<SaleFormValues, 'totalAmount' | 'cashReceived' | 'onlineReceived' | 'laterPaymentsPaise'>) {
  const totalPaise = toPaise(v.totalAmount) ?? 0;
  const cashPaise = toPaise(v.cashReceived) ?? 0;
  const onlinePaise = toPaise(v.onlineReceived) ?? 0;
  const paidPaise = cashPaise + onlinePaise + v.laterPaymentsPaise;
  return { totalPaise, cashPaise, onlinePaise, paidPaise, remainingPaise: totalPaise - paidPaise };
}

export function toSaleInput(v: SaleFormValues): SaleInput {
  return {
    customerId: v.customer!.id,
    saleDate: v.saleDate,
    weight: Number(v.weight),
    totalAmount: Number(v.totalAmount),
    cashReceived: v.cashReceived ? Number(v.cashReceived) : 0,
    onlineReceived: v.onlineReceived ? Number(v.onlineReceived) : 0,
    onlineReference: v.onlineReference || undefined,
    notes: v.notes,
  };
}
