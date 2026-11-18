import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customersApi, dashboardApi, paymentsApi, purchasesApi, reportsApi, salesApi, suppliersApi } from './endpoints';
import type {
  CustomerInput,
  PaymentInput,
  PurchaseInput,
  ReportKind,
  SaleInput,
  SalesQuery,
  SupplierInput,
  SupplierPaymentInput,
} from './types';

export const queryKeys = {
  dashboard: (date: string) => ['dashboard', date] as const,
  sales: (query: SalesQuery) => ['sales', query] as const,
  sale: (id: string) => ['sale', id] as const,
  customers: (search?: string) => ['customers', search ?? ''] as const,
  customer: (id: string) => ['customer', id] as const,
  customerPayments: (id: string) => ['customerPayments', id] as const,
  suppliers: (search?: string) => ['suppliers', search ?? ''] as const,
  supplier: (id: string) => ['supplier', id] as const,
  supplierPurchases: (supplierId: string) => ['supplierPurchases', supplierId] as const,
  purchase: (id: string) => ['purchase', id] as const,
  supplierPayments: (supplierId: string) => ['supplierPayments', supplierId] as const,
  supplierLedger: (supplierId: string) => ['supplierLedger', supplierId] as const,
  report: (kind: ReportKind, params: object) => ['report', kind, params] as const,
};

/**
 * Any sale/payment/customer change affects totals on almost every screen, so
 * every mutation simply invalidates all cached queries (only visible ones refetch).
 */
function useInvalidateAll() {
  const client = useQueryClient();
  return () => client.invalidateQueries();
}

// ---------- queries ----------

export const useDashboard = (date: string) =>
  useQuery({ queryKey: queryKeys.dashboard(date), queryFn: () => dashboardApi.summary(date), placeholderData: keepPreviousData });

export const useSalesInfinite = (query: Omit<SalesQuery, 'page'>) =>
  useInfiniteQuery({
    queryKey: queryKeys.sales(query),
    queryFn: ({ pageParam }) => salesApi.list({ ...query, page: pageParam, limit: 20 }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });

export const useSale = (id: string) => useQuery({ queryKey: queryKeys.sale(id), queryFn: () => salesApi.get(id) });

export const useCustomers = (search?: string) =>
  useQuery({
    queryKey: queryKeys.customers(search),
    queryFn: () => customersApi.list(search),
    placeholderData: keepPreviousData,
  });

export const useCustomer = (id: string) =>
  useQuery({ queryKey: queryKeys.customer(id), queryFn: () => customersApi.get(id) });

export const useCustomerPayments = (id: string) =>
  useInfiniteQuery({
    queryKey: queryKeys.customerPayments(id),
    queryFn: ({ pageParam }) => paymentsApi.byCustomer(id, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });

export const useSuppliers = (search?: string) =>
  useQuery({
    queryKey: queryKeys.suppliers(search),
    queryFn: () => suppliersApi.list(search),
    placeholderData: keepPreviousData,
  });

export const useSupplier = (id: string) =>
  useQuery({ queryKey: queryKeys.supplier(id), queryFn: () => suppliersApi.get(id), enabled: !!id });

export const useSupplierPurchases = (supplierId: string) =>
  useInfiniteQuery({
    queryKey: queryKeys.supplierPurchases(supplierId),
    queryFn: ({ pageParam }) => purchasesApi.bySupplier(supplierId, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });

export const usePurchase = (id: string) =>
  useQuery({ queryKey: queryKeys.purchase(id), queryFn: () => purchasesApi.get(id), enabled: !!id });

export const useSupplierPayments = (supplierId: string) =>
  useQuery({ queryKey: queryKeys.supplierPayments(supplierId), queryFn: () => suppliersApi.payments(supplierId) });

export const useSupplierLedger = (supplierId: string) =>
  useQuery({ queryKey: queryKeys.supplierLedger(supplierId), queryFn: () => suppliersApi.ledger(supplierId) });

export const useReport = (kind: ReportKind, params: { date?: string; from?: string; to?: string }) =>
  useQuery({
    queryKey: queryKeys.report(kind, params),
    queryFn: () => reportsApi.get(kind, params),
    placeholderData: keepPreviousData,
  });

// ---------- mutations ----------

export function useCreateSale() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (input: SaleInput) => salesApi.create(input), onSuccess: invalidate });
}

export function useUpdateSale(id: string) {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (input: Partial<SaleInput>) => salesApi.update(id, input), onSuccess: invalidate });
}

export function useDeleteSale() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (id: string) => salesApi.remove(id), onSuccess: invalidate });
}

export function useAddPayment(saleId: string) {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (input: PaymentInput) => paymentsApi.create(saleId, input), onSuccess: invalidate });
}

export function useAllocatePayment(customerId: string) {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: PaymentInput) => paymentsApi.allocate(customerId, input),
    onSuccess: invalidate,
  });
}

export function useDeletePayment() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (id: string) => paymentsApi.remove(id), onSuccess: invalidate });
}

export function useCreateCustomer() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (input: CustomerInput) => customersApi.create(input), onSuccess: invalidate });
}

export function useUpdateCustomer(id: string) {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: Partial<CustomerInput>) => customersApi.update(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteCustomer() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (id: string) => customersApi.remove(id), onSuccess: invalidate });
}

export function useCreateSupplier() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (input: SupplierInput) => suppliersApi.create(input), onSuccess: invalidate });
}

export function useUpdateSupplier(id: string) {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: Partial<SupplierInput>) => suppliersApi.update(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteSupplier() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (id: string) => suppliersApi.remove(id), onSuccess: invalidate });
}

export function useAddSupplierPayment(supplierId: string) {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: SupplierPaymentInput) => suppliersApi.addPayment(supplierId, input),
    onSuccess: invalidate,
  });
}

export function useDeleteSupplierPayment(supplierId: string) {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (paymentId: string) => suppliersApi.removePayment(supplierId, paymentId), onSuccess: invalidate });
}

export function useCreatePurchase() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (input: PurchaseInput) => purchasesApi.create(input), onSuccess: invalidate });
}

export function useUpdatePurchase(id: string) {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: Partial<PurchaseInput>) => purchasesApi.update(id, input),
    onSuccess: invalidate,
  });
}

export function useDeletePurchase() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (id: string) => purchasesApi.remove(id), onSuccess: invalidate });
}
