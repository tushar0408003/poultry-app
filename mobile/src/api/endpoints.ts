import { api } from './client';
import type {
  Customer,
  CustomerInput,
  DashboardSummary,
  LoginResponse,
  Paginated,
  Payment,
  PaymentInput,
  Report,
  ReportKind,
  Sale,
  SaleDetail,
  SaleInput,
  SalesQuery,
} from './types';

/** Drops empty values so they are not sent as query parameters. */
function clean<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '')) as Partial<T>;
}

export const authApi = {
  login: (username: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { username, password }).then((r) => r.data),
  me: () => api.get<{ id: string; username: string }>('/auth/me').then((r) => r.data),
};

export const customersApi = {
  list: (search?: string) => api.get<Customer[]>('/customers', { params: clean({ search }) }).then((r) => r.data),
  get: (id: string) => api.get<Customer>(`/customers/${id}`).then((r) => r.data),
  create: (input: CustomerInput) => api.post<Customer>('/customers', input).then((r) => r.data),
  update: (id: string, input: Partial<CustomerInput>) => api.patch<Customer>(`/customers/${id}`, input).then((r) => r.data),
  remove: (id: string) => api.delete(`/customers/${id}`).then((r) => r.data),
};

export const salesApi = {
  list: (query: SalesQuery) => api.get<Paginated<Sale>>('/sales', { params: clean(query) }).then((r) => r.data),
  get: (id: string) => api.get<SaleDetail>(`/sales/${id}`).then((r) => r.data),
  create: (input: SaleInput) => api.post<SaleDetail>('/sales', input).then((r) => r.data),
  update: (id: string, input: Partial<SaleInput>) => api.patch<SaleDetail>(`/sales/${id}`, input).then((r) => r.data),
  remove: (id: string) => api.delete<{ deleted: true; paymentsDeleted: number }>(`/sales/${id}`).then((r) => r.data),
};

export const paymentsApi = {
  create: (saleId: string, input: PaymentInput) =>
    api.post<{ payment: Payment; sale: Sale }>('/payments', { saleId, ...input }).then((r) => r.data),
  allocate: (customerId: string, input: PaymentInput) =>
    api
      .post<{ payments: Payment[]; totalAllocated: number }>('/payments/allocate', { customerId, ...input })
      .then((r) => r.data),
  bySale: (saleId: string) => api.get<Payment[]>(`/payments/${saleId}`).then((r) => r.data),
  byCustomer: (customerId: string, page = 1) =>
    api.get<Paginated<Payment>>(`/payments/customer/${customerId}`, { params: { page, limit: 20 } }).then((r) => r.data),
  remove: (id: string) => api.delete<{ deleted: true; sale: Sale | null }>(`/payments/${id}`).then((r) => r.data),
};

export const reportsApi = {
  get: (kind: ReportKind, params: { date?: string; from?: string; to?: string }) => {
    const path = { day: 'daily', week: 'weekly', month: 'monthly', custom: 'custom' }[kind];
    return api.get<Report>(`/reports/${path}`, { params: clean(params) }).then((r) => r.data);
  },
};

export const dashboardApi = {
  summary: (date: string) => api.get<DashboardSummary>('/dashboard/summary', { params: { date } }).then((r) => r.data),
};
