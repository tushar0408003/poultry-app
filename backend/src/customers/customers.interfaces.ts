export interface CustomerStatsResponse {
  salesCount: number;
  weight: number;
  sales: number;
  /** outstanding + sales */
  total: number;
  onlinePayment: number;
  offlinePayment: number;
  /** total - (onlinePayment + offlinePayment) */
  outstandingBalance: number
  lastPaymentDate: string | null;
}

export interface CustomerResponse {
  id: string;
  ownerName: string;
  phone: string;
  address: string;
  outstanding: number;
  createdAt: Date;
  updatedAt: Date;
  stats: CustomerStatsResponse;
}

export type CustomerLedgerEntryType = 'OPENING' | 'SALE' | 'PAYMENT';

/** One line of the customer balance sheet. debit = customer owes more, credit = received. */
export interface CustomerLedgerEntry {
  id: string;
  type: CustomerLedgerEntryType;
  date: string | null;
  description: string;
  /** Sales only. */
  weight: number | null;
  debit: number;
  credit: number;
  /** Running balance after this line. */
  balance: number;
}

export interface CustomerLedgerResponse {
  customerId: string;
  ownerName: string;
  openingBalance: number;
  totalSales: number;
  totalReceived: number;
  closingBalance: number;
  /** Oldest first. */
  entries: CustomerLedgerEntry[];
}
