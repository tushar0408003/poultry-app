export interface CustomerStatsResponse {
  salesCount: number;
  totalWeight: number;
  totalSales: number;
  totalPaid: number;
  outstandingBalance: number;
  lastSaleDate: string | null;
}

export interface CustomerResponse {
  id: string;
  shopName: string;
  ownerName: string;
  phone: string;
  address: string;
  createdAt: Date;
  updatedAt: Date;
  stats: CustomerStatsResponse;
}
