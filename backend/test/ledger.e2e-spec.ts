/**
 * End-to-end tests of the business rules against a real MongoDB.
 *
 *   MONGODB_URI_TEST=mongodb://127.0.0.1:27017/supplier_ledger_e2e npm run test:e2e
 *
 * The test database is DROPPED at the start of the run. Works with both a
 * standalone server and a replica set (transactions enabled).
 */
import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { Connection } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { TransactionService } from '../src/database/transaction.service';
import { setupApp } from '../src/setup-app';

// Env (MONGODB_URI etc.) is set in vitest.e2e.config.mts before this file loads.
const TEST_URI = process.env.MONGODB_URI!;

describe('Supplier ledger (e2e)', () => {
  let app: INestApplication;
  let token: string;
  const api = () => request(app.getHttpServer());
  const get = (url: string) => api().get(url).set('Authorization', `Bearer ${token}`);
  const post = (url: string, body: object) => api().post(url).set('Authorization', `Bearer ${token}`).send(body);
  const patch = (url: string, body: object) => api().patch(url).set('Authorization', `Bearer ${token}`).send(body);
  const del = (url: string) => api().delete(url).set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const connection = moduleRef.get<Connection>(getConnectionToken());
    await connection.dropDatabase();
    await connection.syncIndexes(); // recreate the indexes dropped with the database
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('uses transactions exactly when connected to a replica set', async () => {
    expect(app.get(TransactionService).transactionsSupported).toBe(/replicaSet=/.test(TEST_URI));
  });

  describe('auth', () => {
    it('rejects requests without a token', async () => {
      await api().get('/customers').expect(401);
    });

    it('rejects a wrong password', async () => {
      await api().post('/auth/login').send({ username: 'admin', password: 'nope' }).expect(401);
    });

    it('logs in the seeded admin', async () => {
      const res = await api().post('/auth/login').send({ username: 'ADMIN', password: 'e2e-password' }).expect(200);
      expect(res.body.user.username).toBe('admin');
      token = res.body.accessToken;
      await get('/auth/me').expect(200);
    });
  });

  let shopA: string;
  let shopB: string;

  describe('customers', () => {
    it('creates customers with only owner name and outstanding required', async () => {
      const a = await post('/customers', { ownerName: 'Ravi', phone: '9876543210', outstanding: 0 }).expect(201);
      expect(a.body.ownerName).toBe('Ravi');
      expect(a.body).not.toHaveProperty('shopName');
      expect(a.body.stats.outstandingBalance).toBe(0);
      shopA = a.body.id;
      shopB = (await post('/customers', { ownerName: 'Gupta', outstanding: 0 }).expect(201)).body.id;
    });

    it('validates input', async () => {
      await post('/customers', { outstanding: 0 }).expect(400);
      await post('/customers', { ownerName: '', outstanding: 0 }).expect(400);
      await post('/customers', { ownerName: 'X' }).expect(400);
      await post('/customers', { ownerName: 'X', outstanding: 0, phone: 'abc' }).expect(400);
      await post('/customers', { ownerName: 'X', outstanding: 0, shopName: 'Old field' }).expect(400);
    });
  });

  let saleId: string;

  describe('the spec example: ₹10,000 sale, partial payment, later payment', () => {
    it('creates the sale with initial cash + online payments', async () => {
      const res = await post('/sales', {
        customerId: shopA,
        saleDate: '2026-10-01',
        weight: 50,
        ratePerKg: 200,
        cashReceived: 2000,
        onlineReceived: 3000,
        onlineReference: 'UPI123',
      }).expect(201);

      saleId = res.body.id;
      expect(res.body).toMatchObject({
        totalAmount: 10000,
        cashReceived: 2000,
        onlineReceived: 3000,
        status: 'PARTIAL',
        saleDate: '2026-10-01',
      });
      expect(res.body.payments).toHaveLength(2);
      expect(res.body.payments.every((p: { source: string; paymentDate: string }) =>
        p.source === 'SALE_ENTRY' && p.paymentDate === '2026-10-01')).toBe(true);
    });

    it('records a later cash payment as a NEW record and updates the original sale', async () => {
      const res = await post('/payments', {
        saleId,
        amount: 2000,
        paymentMode: 'CASH',
        paymentDate: '2026-10-04',
      }).expect(201);
      expect(res.body.sale).toMatchObject({ cashReceived: 4000, onlineReceived: 3000, status: 'PARTIAL' });

      const history = await get(`/payments/${saleId}`).expect(200);
      expect(history.body.map((p: { amount: number }) => p.amount)).toEqual([2000, 3000, 2000]);
    });

    it('rejects payments above the balance, before the sale date, or in the future', async () => {
      const over = await post('/payments', { saleId, amount: 3000.01, paymentMode: 'ONLINE', paymentDate: '2026-10-05' }).expect(400);
      expect(over.body.message).toMatch(/more than the balance due \(₹3,000\)/);
      await post('/payments', { saleId, amount: 100, paymentMode: 'CASH', paymentDate: '2026-09-30' }).expect(400);
      await post('/payments', { saleId, amount: 100, paymentMode: 'CASH', paymentDate: '2099-01-01' }).expect(400);
      await post('/payments', { saleId, amount: 0, paymentMode: 'CASH' }).expect(400);
      await post('/payments', { saleId, amount: 10.001, paymentMode: 'CASH' }).expect(400);
      await post('/payments', { saleId, amount: 10, paymentMode: 'CHEQUE' }).expect(400);
    });
  });

  describe('sale validation', () => {
    it.each([
      [{ weight: 0 }, /weight/],
      [{ ratePerKg: 0 }, /ratePerKg/],
      [{ cashReceived: -1 }, /cashReceived/],
      [{ cashReceived: 600, onlineReceived: 500 }, /cannot be more than the sale amount/],
      [{ saleDate: '2099-01-01' }, /future/],
      [{ saleDate: '2026-02-30' }, /YYYY-MM-DD/],
    ])('rejects %p', async (override, message) => {
      const res = await post('/sales', { customerId: shopB, weight: 10, ratePerKg: 100, ...override }).expect(400);
      expect(JSON.stringify(res.body.message)).toMatch(message);
    });

    it('rejects an unknown customer', async () => {
      await post('/sales', { customerId: '0123456789abcdef01234567', weight: 1, ratePerKg: 1 }).expect(404);
    });

    it('calculates exactly with fractional values', async () => {
      const res = await post('/sales', { customerId: shopB, saleDate: '2026-10-02', weight: 12.345, ratePerKg: 199.99 }).expect(201);
      expect(res.body.totalAmount).toBe(2468.88);
      expect(res.body.status).toBe('UNPAID');
      await del(`/sales/${res.body.id}`).expect(200);
    });
  });

  describe('reports separate sales (by sale date) from collections (by payment date)', () => {
    it('daily report on the sale date', async () => {
      const r = (await get('/reports/daily?date=2026-10-01').expect(200)).body;
      expect(r.sales).toMatchObject({ count: 1, totalWeight: 50, totalAmount: 10000 });
      expect(r.collections).toMatchObject({ cash: 2000, online: 3000, total: 5000 });
      expect(r.currentOutstanding.amount).toBe(3000);
    });

    it('daily report on the later payment date counts the collection, not a sale', async () => {
      const r = (await get('/reports/daily?date=2026-10-04').expect(200)).body;
      expect(r.sales).toMatchObject({ count: 0, totalAmount: 0 });
      expect(r.collections).toMatchObject({ cash: 2000, online: 0, total: 2000 });
      expect(r.currentOutstanding.amount).toBe(3000);
    });

    it('weekly / monthly reports with previous-period comparison and series', async () => {
      const week = (await get('/reports/weekly?date=2026-10-01').expect(200)).body;
      expect(week).toMatchObject({ from: '2026-09-28', to: '2026-10-04' });
      expect(week.collections.total).toBe(7000);
      expect(week.series.points).toHaveLength(7);

      const month = (await get('/reports/monthly?date=2026-10-15').expect(200)).body;
      expect(month).toMatchObject({ from: '2026-10-01', to: '2026-10-31' });
      expect(month.sales.totalAmount).toBe(10000);
      expect(month.previous).toMatchObject({ from: '2026-09-01', to: '2026-09-30' });
      expect(month.comparison.totalSales).toBeNull(); // previous month had no sales
      expect(month.series.points.find((p: { label: string }) => p.label === '2026-10-04').cash).toBe(2000);
    });

    it('custom range', async () => {
      const r = (await get('/reports/custom?from=2026-10-01&to=2026-10-03').expect(200)).body;
      expect(r.collections.total).toBe(5000);
      await get('/reports/custom?from=2026-10-03&to=2026-10-01').expect(400);
    });

    it('dashboard summary for a date', async () => {
      const d = (await get('/dashboard/summary?date=2026-10-04').expect(200)).body;
      expect(d.day).toMatchObject({ totalSales: 0, cashReceived: 2000, totalReceived: 2000 });
      expect(d.currentOutstanding).toMatchObject({ amount: 3000, customers: 1 });
      expect(d.recentSales[0].id).toBe(saleId);
    });
  });

  describe('editing a sale recalculates the balance safely', () => {
    it('recalculates when the weight changes', async () => {
      const res = await patch(`/sales/${saleId}`, { weight: 40 }).expect(200);
      expect(res.body).toMatchObject({ totalAmount: 8000, cashReceived: 4000, onlineReceived: 3000, status: 'PARTIAL' });
    });

    it('refuses a new total below what has already been paid', async () => {
      const res = await patch(`/sales/${saleId}`, { weight: 30 }).expect(400);
      expect(res.body.message).toMatch(/₹7,000.*₹6,000/);
      expect((await get(`/sales/${saleId}`)).body.totalAmount).toBe(8000);
    });

    it('refuses moving the sale date after an existing collection', async () => {
      await patch(`/sales/${saleId}`, { saleDate: '2026-10-05' }).expect(400);
    });

    it('moves "received at sale" payments with the sale date', async () => {
      const res = await patch(`/sales/${saleId}`, { saleDate: '2026-09-30' }).expect(200);
      const entry = res.body.payments.filter((p: { source: string }) => p.source === 'SALE_ENTRY');
      expect(entry.map((p: { paymentDate: string }) => p.paymentDate)).toEqual(['2026-09-30', '2026-09-30']);
      const later = res.body.payments.find((p: { source: string }) => p.source === 'COLLECTION');
      expect(later.paymentDate).toBe('2026-10-04');
    });

    it('replaces the cash received at sale time without touching later collections', async () => {
      const res = await patch(`/sales/${saleId}`, { cashReceived: 0 }).expect(200);
      expect(res.body).toMatchObject({ totalAmount: 8000, cashReceived: 2000, onlineReceived: 3000, status: 'PARTIAL' });
      expect(res.body.payments).toHaveLength(2);
    });

    it('moves payments when the customer changes', async () => {
      await patch(`/sales/${saleId}`, { customerId: shopB }).expect(200);
      const payments = (await get(`/payments/customer/${shopB}`).expect(200)).body;
      expect(payments.total).toBe(2);
      const a = (await get(`/customers/${shopA}`)).body;
      const b = (await get(`/customers/${shopB}`)).body;
      expect(a.stats.outstandingBalance).toBe(0);
      expect(b.stats).toMatchObject({ salesCount: 1, sales: 8000, total: 8000, offlinePayment: 2000, onlinePayment: 3000, outstandingBalance: 3000 });
      await patch(`/sales/${saleId}`, { customerId: shopA }).expect(200);
    });
  });

  describe('lump-sum payment split across oldest sales first', () => {
    let second: string;

    it('allocates FIFO', async () => {
      second = (await post('/sales', { customerId: shopA, saleDate: '2026-10-10', weight: 10, ratePerKg: 150 }).expect(201)).body.id;
      // shop A owes 3000 (old sale) + 1500 (new sale)
      const res = await post('/payments/allocate', { customerId: shopA, amount: 4000, paymentMode: 'ONLINE', paymentDate: '2026-10-11' }).expect(201);
      expect(res.body.payments.map((p: { amount: number }) => p.amount)).toEqual([3000, 1000]);
      expect((await get(`/sales/${saleId}`)).body.status).toBe('PAID');
      expect((await get(`/sales/${second}`)).body).toSatisfy((s: { totalAmount: number; cashReceived: number; onlineReceived: number }) => s.totalAmount - s.cashReceived - s.onlineReceived === 500);
    });

    it('does not allocate to sales dated after the payment', async () => {
      await post('/payments/allocate', { customerId: shopA, amount: 100, paymentMode: 'CASH', paymentDate: '2026-10-09' }).expect(400);
    });

    it('filters transactions by payment status and search', async () => {
      const paid = (await get('/sales?status=PAID').expect(200)).body;
      expect(paid.items.map((s: { id: string }) => s.id)).toEqual([saleId]);
      const partial = (await get('/sales?status=PARTIAL&search=ravi').expect(200)).body;
      expect(partial.items.map((s: { id: string }) => s.id)).toEqual([second]);
      expect((await get('/sales?search=gupta').expect(200)).body.total).toBe(0);
      expect((await get('/sales?date=2026-10-10').expect(200)).body.total).toBe(1);
    });

    it('deleting a wrong payment restores the balance', async () => {
      const history = (await get(`/payments/${second}`)).body;
      const res = await del(`/payments/${history[0].id}`).expect(200);
      expect(res.body.sale).toMatchObject({ cashReceived: 0, onlineReceived: 0, status: 'UNPAID' });
    });

    it('deleting a sale removes its payments and updates outstanding', async () => {
      const before = (await get('/dashboard/summary')).body.currentOutstanding.amount;
      const res = await del(`/sales/${second}`).expect(200);
      expect(res.body.paymentsDeleted).toBe(0);
      expect((await get('/dashboard/summary')).body.currentOutstanding.amount).toBe(before - 1500);

      const r = await del(`/sales/${saleId}`).expect(200);
      expect(r.body.paymentsDeleted).toBe(3);
      expect((await get(`/payments/customer/${shopA}`)).body.total).toBe(0);
      await get(`/sales/${saleId}`).expect(404);
    });
  });

  describe('outstanding', () => {
    it('is paid before sales and counted in the customer totals', async () => {
      const c = (await post('/customers', { ownerName: 'Old Dues', outstanding: 1000 }).expect(201)).body;
      expect(c.stats).toMatchObject({ total: 1000, outstandingBalance: 1000 });
      const s = (await post('/sales', { customerId: c.id, saleDate: '2026-10-12', weight: 10, ratePerKg: 100 }).expect(201)).body.id;

      const res = await post('/payments/allocate', { customerId: c.id, amount: 1500, paymentMode: 'CASH', paymentDate: '2026-10-12' }).expect(201);
      expect(res.body.payments.map((p: { saleId: string | null; amount: number }) => [p.saleId, p.amount])).toEqual([[null, 1000], [s, 500]]);
      await post('/payments/allocate', { customerId: c.id, amount: 500.01, paymentMode: 'CASH', paymentDate: '2026-10-12' }).expect(400);

      const after = (await get(`/customers/${c.id}`)).body;
      expect(after.stats).toMatchObject({ sales: 1000, total: 2000, offlinePayment: 1500, outstandingBalance: 500, lastPaymentDate: '2026-10-12' });
      await patch(`/customers/${c.id}`, { outstanding: 999 }).expect(400);

      const del1 = await del(`/payments/${res.body.payments[0].id}`).expect(200);
      expect(del1.body.sale).toBeNull();
      expect((await get(`/customers/${c.id}`)).body.stats.outstandingBalance).toBe(1500);
      await del(`/sales/${s}`).expect(200);
    });
  });

  describe('concurrency', () => {
    it.runIf(/replicaSet=/.test(TEST_URI))('parallel payments never overpay a sale', async () => {
      const id = (await post('/sales', { customerId: shopA, saleDate: '2026-10-20', weight: 30, ratePerKg: 100 }).expect(201)).body.id;
      const results = await Promise.all(
        Array.from({ length: 6 }, () => post('/payments', { saleId: id, amount: 1000, paymentMode: 'CASH', paymentDate: '2026-10-20' })),
      );
      expect(results.filter((r) => r.status === 201)).toHaveLength(3);
      expect(results.filter((r) => r.status === 400)).toHaveLength(3);
      const sale = (await get(`/sales/${id}`)).body;
      expect(sale).toMatchObject({ cashReceived: 3000, onlineReceived: 0, status: 'PAID' });
      expect(sale.payments).toHaveLength(3);
      await del(`/sales/${id}`).expect(200);
    });
  });

  describe('customer deletion', () => {
    it('blocks deleting a customer with sales, allows it without', async () => {
      const s = (await post('/sales', { customerId: shopB, weight: 1, ratePerKg: 1 }).expect(201)).body.id;
      await del(`/customers/${shopB}`).expect(409);
      await del(`/sales/${s}`).expect(200);
      await del(`/customers/${shopB}`).expect(200);
      await get(`/customers/${shopB}`).expect(404);
    });

    it('rejects malformed ids', async () => {
      await get('/customers/not-an-id').expect(400);
    });
  });
});
