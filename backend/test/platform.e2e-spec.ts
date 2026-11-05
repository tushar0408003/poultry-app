/**
 * Phase 2 platform services against a real MongoDB: inventory replay,
 * settings and audit trail. The test database is DROPPED first.
 */
import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types, type Connection } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { parseDateOnly } from '../src/common/dates';
import { TransactionService } from '../src/database/transaction.service';
import { InventoryType } from '../src/inventory/costing';
import { InventoryLedger } from '../src/inventory/inventory-ledger.service';
import { setupApp } from '../src/setup-app';

describe('Platform (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let inventory: InventoryLedger;
  let tx: TransactionService;
  const api = () => request(app.getHttpServer());
  const get = (url: string) => api().get(url).set('Authorization', `Bearer ${token}`);
  const patch = (url: string, body: object) => api().patch(url).set('Authorization', `Bearer ${token}`).send(body);
  const d = parseDateOnly;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const connection = moduleRef.get<Connection>(getConnectionToken());
    await connection.dropDatabase();
    await connection.syncIndexes();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    inventory = app.get(InventoryLedger);
    tx = app.get(TransactionService);
    token = (await api().post('/auth/login').send({ username: 'admin', password: 'e2e-password' }).expect(200)).body
      .accessToken;
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('inventory ledger (weighted average, replay)', () => {
    const purchase1 = new Types.ObjectId();
    const purchase2 = new Types.ObjectId();
    const sale1 = new Types.ObjectId();
    const sale2 = new Types.ObjectId();

    it('costs sales at the running weighted average', async () => {
      await tx.run(async (s) => {
        await inventory.create({ type: InventoryType.PURCHASE_IN, date: d('2026-10-01'), sourceId: purchase1, quantityGrams: 100_000, amountPaise: 1_200_000 }, s);
        await inventory.create({ type: InventoryType.SALE_OUT, date: d('2026-10-01'), sourceId: sale1, quantityGrams: 50_000 }, s);
        await inventory.create({ type: InventoryType.PURCHASE_IN, date: d('2026-10-02'), sourceId: purchase2, quantityGrams: 50_000, amountPaise: 750_000 }, s);
        await inventory.create({ type: InventoryType.SALE_OUT, date: d('2026-10-02'), sourceId: sale2, quantityGrams: 40_000 }, s);
      });
      expect((await inventory.findBySource(sale1))!.valuePaise).toBe(-600_000); // 50 kg @ ₹120
      // Day 2 average: (50 kg x ₹120 + 50 kg x ₹150) / 100 kg = ₹135
      expect((await inventory.findBySource(sale2))!.valuePaise).toBe(-540_000);
      expect(await inventory.stockAsOf(d('2026-10-02'))).toEqual({
        balanceGrams: 60_000,
        balanceValuePaise: 810_000,
        avgRatePaisePerKg: 13_500,
      });
    });

    it('orders purchases before sales within a day, whatever the entry order', async () => {
      // Sale entered first, purchase entered later, both on 5 Oct.
      const sale = new Types.ObjectId();
      await inventory.create({ type: InventoryType.SALE_OUT, date: d('2026-10-05'), sourceId: sale, quantityGrams: 10_000 }, undefined);
      await inventory.create({ type: InventoryType.PURCHASE_IN, date: d('2026-10-05'), sourceId: new Types.ObjectId(), quantityGrams: 60_000, amountPaise: 1_020_000 }, undefined);
      // (60 kg @ ₹135 + 60 kg @ ₹170) / 120 kg = ₹152.50
      expect((await inventory.findBySource(sale))!.valuePaise).toBe(-152_500);
    });

    it('a back-dated edit recalculates every later cost', async () => {
      // Correct the first purchase price from ₹120 to ₹100 per kg.
      await inventory.updateBySource(purchase1, { amountPaise: 1_000_000 });
      expect((await inventory.findBySource(sale1))!.valuePaise).toBe(-500_000);
      // Day 2: (50 kg @ ₹100 + 50 kg @ ₹150) / 100 = ₹125
      expect((await inventory.findBySource(sale2))!.valuePaise).toBe(-500_000);
    });

    it('moving a record to another date replays from the earlier date', async () => {
      await inventory.updateBySource(purchase2, { date: d('2026-09-30') });
      // Now 30 Sep: 50 kg @ ₹150; 1 Oct: +100 kg @ ₹100 -> avg (7,500 + 10,000) / 150 = ₹116.67
      expect((await inventory.findBySource(sale1))!.valuePaise).toBe(-583_333);
    });

    it('deleting a movement recalculates later rows', async () => {
      await inventory.removeBySource(purchase2);
      expect((await inventory.findBySource(sale1))!.valuePaise).toBe(-500_000);
    });

    it('records losses and closing counts at average cost', async () => {
      const before = await inventory.stockAsOf(d('2026-10-06'));
      const loss = await inventory.create({ type: InventoryType.LOSS, date: d('2026-10-06'), quantityGrams: 1_000, reason: 'mortality' });
      expect(loss.deltaGrams).toBe(-1_000);
      expect(loss.valuePaise).toBe(-Math.round(before.avgRatePaisePerKg));
      const count = await inventory.create({ type: InventoryType.STOCK_COUNT, date: d('2026-10-06'), countedGrams: 0 });
      expect(count.balanceGrams).toBe(0);
      expect(count.balanceValuePaise).toBe(0);
    });

    it('never blocks: stock may go negative', async () => {
      const sale = await inventory.create({ type: InventoryType.SALE_OUT, date: d('2026-10-07'), sourceId: new Types.ObjectId(), quantityGrams: 5_000 });
      expect(sale.balanceGrams).toBe(-5_000);
      expect(sale.valuePaise).toBeLessThan(0); // costed at the last known average
    });

    it('a full rebuild is idempotent', async () => {
      expect(await inventory.rebuild()).toBe(0);
    });
  });

  describe('settings', () => {
    it('returns defaults on first use', async () => {
      const res = await get('/settings').expect(200);
      expect(res.body).toMatchObject({ businessName: 'My Poultry Business', defaultPurchaseRate: 0, defaultSaleRate: 0 });
    });

    it('updates and validates', async () => {
      const res = await patch('/settings', { businessName: 'Jakhar Poultry', defaultSaleRate: 185.5 }).expect(200);
      expect(res.body).toMatchObject({ businessName: 'Jakhar Poultry', defaultSaleRate: 185.5, defaultPurchaseRate: 0 });
      await patch('/settings', { defaultSaleRate: -1 }).expect(400);
      await patch('/settings', { defaultSaleRate: 1.234 }).expect(400);
      await patch('/settings', { businessName: '   ' }).expect(400);
      await patch('/settings', { unknown: 1 }).expect(400);
    });
  });

  describe('audit trail', () => {
    it('records who changed what', async () => {
      const res = await get('/audit?entity=settings').expect(200);
      expect(res.body.total).toBe(1);
      const [log] = res.body.items;
      expect(log).toMatchObject({ entity: 'settings', action: 'UPDATE', username: 'admin' });
      expect(log.changedFields.sort()).toEqual(['businessName', 'defaultSaleRatePaise']);
      expect(log.before.businessName).toBe('My Poultry Business');
      expect(log.after.defaultSaleRatePaise).toBe(18_550);
    });

    it('validates filters', async () => {
      await get('/audit?entity=nope').expect(400);
      await get('/audit?entityId=123').expect(400);
    });
  });
});
