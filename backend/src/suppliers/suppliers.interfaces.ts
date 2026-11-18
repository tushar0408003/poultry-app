import type { PaymentMode } from '../payments/payment.schema';

/** Purchase and payment totals for one supplier. Money in rupees, weight in kg. */
export interface SupplierStatsResponse {
  purchasesCount: number;
  weight: number;
  purchases: number;
  /** Paid while entering purchases (cash + online). */
  paidAtPurchase: number;
  /** Paid later against the balance. */
  payments: number;
  paymentsCount: number;
  /** paidAtPurchase + payments */
  paid: number;
  /** outstanding + purchases - paid: still owed to the supplier (negative = advance). */
  balance: number;
}

export interface SupplierResponse {
  id: string;
  ownerName: string;
  phone: string;
  address: string;
  /** Old dues owed to the supplier, rupees. */
  outstanding: number;
  /** Rate per kg, rupees. */
  rate: number;
  /** Weight entered on the supplier, kg. */
  weight: number;
  createdAt: Date;
  updatedAt: Date;
  stats: SupplierStatsResponse;
}

export interface SupplierPaymentResponse {
  id: string;
  supplierId: string;
  paymentDate: string;
  amount: number;
  paymentMode: PaymentMode;
  transactionReference: string;
  notes: string;
}

export type SupplierLedgerEntryType = 'OPENING' | 'PURCHASE' | 'PAYMENT';

/** One line of the supplier balance sheet. debit = we owe more, credit = we paid. */
export interface SupplierLedgerEntry {
  id: string;
  type: SupplierLedgerEntryType;
  date: string | null;
  description: string;
  /** Purchases only. */
  weight: number | null;
  rate: number | null;
  debit: number;
  credit: number;
  /** Running balance after this line. */
  balance: number;
}

export interface SupplierLedgerResponse {
  supplierId: string;
  ownerName: string;
  openingBalance: number;
  totalPurchases: number;
  totalPaid: number;
  closingBalance: number;
  /** Oldest first. */
  entries: SupplierLedgerEntry[];
}
