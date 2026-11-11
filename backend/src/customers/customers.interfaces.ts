export interface CustomerStatsResponse {
  salesCount: number;
  weight: number;
  sales: number;
  /** outstanding + sales */
  total: number;
  onlinePayment: number;
  offlinePayment: number;
  /** total - (onlinePayment + offlinePayment) */
  outstandingBalance: number;
  lastPaymentDate: string | null;
}

export interface CustomerResponse {
  id: string;
  shopName: string;
  ownerName: string;
  phone: string;
  address: string;
  outstanding: number;
  createdAt: Date;
  updatedAt: Date;
  stats: CustomerStatsResponse;
}
