/** Response/request shapes of the backend API (see docs/API.md). Money in rupees, weight in kg. */

export type PaymentStatus = 'PAID' | 'PARTIAL' | 'UNPAID';
export type PaymentMode = 'CASH' | 'ONLINE';
export type PaymentSource = 'SALE_ENTRY' | 'COLLECTION';

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CustomerSummary {
  id: string;
  ownerName: string;
  phone: string;
}

export interface CustomerStats {
  salesCount: number;
  weight: number;
  sales: number;
  total: number;
  onlinePayment: number;
  offlinePayment: number;
  outstandingBalance: number;
  lastPaymentDate: string | null;
}

export interface Customer extends CustomerSummary {
  address: string;
  outstanding: number;
  createdAt: string;
  updatedAt: string;
  stats: CustomerStats;
}

export interface CustomerInput {
  ownerName: string;
  phone?: string;
  address?: string;
  outstanding: number;
}

export interface SupplierStats {
  purchasesCount: number;
  weight: number;
  purchases: number;
  /** Paid while entering purchases. */
  paidAtPurchase: number;
  /** Paid later against the balance. */
  payments: number;
  paymentsCount: number;
  /** paidAtPurchase + payments */
  paid: number;
  /** outstanding + purchases - paid: still owed to the supplier (negative = advance). */
  balance: number;
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  paymentDate: string;
  amount: number;
  paymentMode: PaymentMode;
  transactionReference: string;
  notes: string;
}

export interface SupplierPaymentInput {
  amount: number;
  paymentMode: PaymentMode;
  paymentDate?: string;
  transactionReference?: string;
  notes?: string;
}

export interface SupplierLedgerEntry {
  id: string;
  type: 'OPENING' | 'PURCHASE' | 'PAYMENT';
  date: string | null;
  description: string;
  weight: number | null;
  rate: number | null;
  /** Added to what we owe (purchase / old dues). */
  debit: number;
  /** Paid to the supplier. */
  credit: number;
  /** Running balance after this line. */
  balance: number;
}

export interface SupplierLedger {
  supplierId: string;
  ownerName: string;
  openingBalance: number;
  totalPurchases: number;
  totalPaid: number;
  closingBalance: number;
  /** Oldest first. */
  entries: SupplierLedgerEntry[];
}

export interface Supplier {
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
  createdAt: string;
  updatedAt: string;
  stats: SupplierStats;
}

export interface SupplierInput {
  ownerName: string;
  phone?: string;
  address?: string;
  outstanding: number;
  rate: number;
  weight?: number;
}

export interface Purchase {
  id: string;
  supplierId: string;
  supplier: { id: string; ownerName: string; phone: string } | null;
  purchaseDate: string;
  weight: number;
  /** Rate per kg used for this purchase. */
  rate: number;
  totalAmount: number;
  cashPaid: number;
  onlinePaid: number;
  remaining: number;
  status: PaymentStatus;
  notes: string;
}

export interface PurchaseInput {
  supplierId: string;
  purchaseDate?: string;
  weight: number;
  /** Defaults to the supplier's rate on the server when left out. */
  rate?: number;
  cashPaid?: number;
  onlinePaid?: number;
  notes?: string;
}

export interface Payment {
  id: string;
  saleId: string | null;
  customerId: string;
  customer: CustomerSummary | null;
  amount: number;
  paymentMode: PaymentMode;
  paymentDate: string;
  transactionReference: string;
  source: PaymentSource;
  createdAt: string;
}

export interface Sale {
  id: string;
  customerId: string;
  customer: CustomerSummary | null;
  saleDate: string;
  weight: number;
  totalAmount: number;
  cashReceived: number;
  onlineReceived: number;
  status: PaymentStatus;
  notes: string;
}

export interface SaleDetail extends Sale {
  payments: Payment[];
}

export interface SaleInput {
  customerId: string;
  saleDate: string;
  weight: number;
  totalAmount: number;
  cashReceived: number;
  onlineReceived: number;
  onlineReference?: string;
  notes?: string;
}

export interface SalesQuery {
  page?: number;
  limit?: number;
  search?: string;
  customerId?: string;
  date?: string;
  from?: string;
  to?: string;
  status?: PaymentStatus;
}

export interface PaymentInput {
  amount: number;
  paymentMode: PaymentMode;
  paymentDate: string;
  transactionReference?: string;
}

export interface PeriodSummary {
  from: string;
  to: string;
  sales: { count: number; totalWeight: number; totalAmount: number; paidSoFar: number; stillUnpaid: number };
  collections: { count: number; cash: number; online: number; total: number };
}

export interface CurrentOutstanding {
  amount: number;
  customers: number;
  sales: number;
}

export interface SeriesPoint {
  label: string;
  weight: number;
  sales: number;
  cash: number;
  online: number;
  collected: number;
}

export type ReportKind = 'day' | 'week' | 'month' | 'custom';

export interface Report extends PeriodSummary {
  kind: ReportKind;
  currentOutstanding: CurrentOutstanding;
  previous: PeriodSummary;
  comparison: { totalWeight: number | null; totalSales: number | null; totalCollected: number | null };
  series: { granularity: 'day' | 'month'; points: SeriesPoint[] };
}

export interface DashboardSummary {
  date: string;
  isToday: boolean;
  day: {
    totalWeight: number;
    totalSales: number;
    salesCount: number;
    cashReceived: number;
    onlineReceived: number;
    totalReceived: number;
  };
  currentOutstanding: CurrentOutstanding;
  week: PeriodSummary;
  month: PeriodSummary;
  recentSales: Sale[];
  recentPayments: Payment[];
}

export interface LoginResponse {
  accessToken: string;
  user: { id: string; username: string };
}
