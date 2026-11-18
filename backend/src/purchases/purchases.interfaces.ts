import type { Types } from 'mongoose';
import type { PaymentStatus } from '../common/money';
import type { Supplier } from '../suppliers/supplier.schema';
import type { Purchase } from './purchase.schema';

export interface SupplierSummary {
  id: string;
  ownerName: string;
  phone: string;
}

/** Money in rupees, weight in kg. */
export interface PurchaseResponse {
  id: string;
  supplierId: string;
  supplier: SupplierSummary | null;
  purchaseDate: string;
  weight: number;
  rate: number;
  totalAmount: number;
  cashPaid: number;
  onlinePaid: number;
  remaining: number;
  status: PaymentStatus;
  notes: string;
}

export type SupplierRef = Pick<Supplier, '_id' | 'ownerName' | 'phone'>;

export type PurchaseWithSupplier = Omit<Purchase, 'supplierId'> & { supplierId: SupplierRef | null };

/** Per-supplier totals from the purchases collection: grams and paise. */
export interface SupplierPurchaseStats {
  _id: Types.ObjectId;
  count: number;
  weightGrams: number;
  totalPaise: number;
  paidPaise: number;
}
