import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customersApi, dashboardApi, paymentsApi, reportsApi, salesApi } from './endpoints';
import type { CustomerInput, PaymentInput, ReportKind, SaleInput, SalesQuery } from './types';

export const queryKeys = {
  dashboard: (date: string) => ['dashboard', date] as const,
  sales: (query: SalesQuery) => ['sales', query] as const,
  sale: (id: string) => ['sale', id] as const,
  customers: (search?: string) => ['customers', search ?? ''] as const,
  customer: (id: string) => ['customer', id] as const,
  customerPayments: (id: string) => ['customerPayments', id] as const,
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
