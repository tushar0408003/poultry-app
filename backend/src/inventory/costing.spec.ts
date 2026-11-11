import { applyMovement, divRound, EMPTY_STOCK, InventoryType, replay } from './costing';
import type { MovementInput } from './inventory.interfaces';

const buy = (kg: number, rupeesPerKg: number): MovementInput => ({
  type: InventoryType.PURCHASE_IN,
  quantityGrams: kg * 1000,
  amountPaise: kg * rupeesPerKg * 100,
});
const sell = (grams: number): MovementInput => ({ type: InventoryType.SALE_OUT, quantityGrams: grams });
const lose = (grams: number): MovementInput => ({ type: InventoryType.LOSS, quantityGrams: grams });
const count = (grams: number): MovementInput => ({ type: InventoryType.STOCK_COUNT, countedGrams: grams });

describe('inventory costing (weighted average)', () => {
  it('rounds signed division half away from zero', () => {
    expect(divRound(5n, 2n)).toBe(3n);
    expect(divRound(-5n, 2n)).toBe(-3n);
    expect(divRound(4n, 3n)).toBe(1n);
    expect(divRound(7n, -2n)).toBe(-4n);
  });

  it('a purchase sets stock and average rate', () => {
    const r = applyMovement(EMPTY_STOCK, buy(100, 120));
    expect(r).toEqual({ deltaGrams: 100_000, valuePaise: 1_200_000, balanceGrams: 100_000, balanceValuePaise: 1_200_000, avgRatePaisePerKg: 12_000 });
  });

  it('averages two purchases at different prices and costs sales at the average', () => {
    // 100 kg @ ₹120 + 100 kg @ ₹140 = 200 kg worth ₹26,000 -> avg ₹130/kg
    const [, p2, s] = replay(EMPTY_STOCK, [buy(100, 120), buy(100, 140), sell(50_000)]);
    expect(p2.avgRatePaisePerKg).toBe(13_000);
    expect(s.valuePaise).toBe(-650_000); // COGS ₹6,500 for 50 kg
    expect(s.balanceGrams).toBe(150_000);
    expect(s.balanceValuePaise).toBe(1_950_000);
  });

  it('is NOT "today\'s purchases minus today\'s sales": leftover stock keeps its cost', () => {
    // Day 1: buy 100 kg @ ₹100, sell 60 kg. Day 2: buy 10 kg @ ₹150, sell 50 kg.
    const r = replay(EMPTY_STOCK, [buy(100, 100), sell(60_000), buy(10, 150), sell(50_000)]);
    // Day-2 average: (40 kg x ₹100 + 10 kg x ₹150) / 50 kg = ₹110/kg
    expect(r[3].valuePaise).toBe(-550_000);
    expect(r[3].balanceGrams).toBe(0);
    expect(r[3].balanceValuePaise).toBe(0);
  });

  it('never drifts: value is conserved exactly across awkward fractions', () => {
    const inputs: MovementInput[] = [
      { type: InventoryType.PURCHASE_IN, quantityGrams: 33_333, amountPaise: 400_001 },
      sell(7_777),
      sell(11_111),
      { type: InventoryType.PURCHASE_IN, quantityGrams: 1_234, amountPaise: 19_999 },
      lose(333),
      sell(15_346), // exactly the rest
    ];
    const r = replay(EMPTY_STOCK, inputs);
    const purchased = 400_001 + 19_999;
    const outflow = r.filter((x) => x.valuePaise < 0).reduce((s, x) => s - x.valuePaise, 0);
    expect(r.at(-1)!.balanceGrams).toBe(0);
    expect(outflow).toBe(purchased);
    expect(r.at(-1)!.balanceValuePaise).toBe(0);
  });

  it('records a loss at average cost', () => {
    const [, l] = replay(EMPTY_STOCK, [buy(100, 120), lose(2_500)]);
    expect(l.deltaGrams).toBe(-2_500);
    expect(l.valuePaise).toBe(-30_000); // 2.5 kg x ₹120
  });

  it('a closing count turns a shortfall into a loss', () => {
    const [, , c] = replay(EMPTY_STOCK, [buy(100, 120), sell(90_000), count(8_000)]);
    expect(c.deltaGrams).toBe(-2_000);
    expect(c.valuePaise).toBe(-24_000);
    expect(c.balanceGrams).toBe(8_000);
  });

  it('a closing count surplus is a gain at the average rate', () => {
    const [, c] = replay(EMPTY_STOCK, [buy(10, 100), count(10_500)]);
    expect(c.deltaGrams).toBe(500);
    expect(c.valuePaise).toBe(5_000);
  });

  it('a count equal to book stock changes nothing', () => {
    const [p, c] = replay(EMPTY_STOCK, [buy(10, 100), count(10_000)]);
    expect(c.deltaGrams).toBe(0);
    expect(c.valuePaise).toBe(0);
    expect(c.balanceValuePaise).toBe(p.balanceValuePaise);
  });

  describe('negative stock (sales never blocked)', () => {
    it('costs a sale at the last known rate when stock is empty', () => {
      const r = replay(EMPTY_STOCK, [buy(10, 100), sell(10_000), sell(5_000)]);
      expect(r[2].valuePaise).toBe(-50_000);
      expect(r[2].balanceGrams).toBe(-5_000);
    });

    it('costs an over-draw proportionally', () => {
      const [, s] = replay(EMPTY_STOCK, [buy(10, 100), sell(12_000)]);
      expect(s.valuePaise).toBe(-120_000);
      expect(s.balanceGrams).toBe(-2_000);
    });

    it('a sale with no purchase ever has zero cost', () => {
      const [s] = replay(EMPTY_STOCK, [sell(5_000)]);
      expect(s.valuePaise).toBe(0);
      expect(s.avgRatePaisePerKg).toBe(0);
    });

    it('a later purchase conserves the total cost', () => {
      const r = replay(EMPTY_STOCK, [buy(10, 100), sell(15_000), buy(20, 130), sell(15_000)]);
      const purchased = 100_000 + 260_000;
      const cogs = -(r[1].valuePaise + r[3].valuePaise);
      expect(r[3].balanceGrams).toBe(0);
      expect(cogs + r[3].balanceValuePaise).toBe(purchased);
      expect(r[3].balanceValuePaise).toBe(0);
    });
  });

  it('rejects invalid quantities', () => {
    expect(() => applyMovement(EMPTY_STOCK, { type: InventoryType.SALE_OUT, quantityGrams: -1 })).toThrow(RangeError);
    expect(() => applyMovement(EMPTY_STOCK, { type: InventoryType.PURCHASE_IN, quantityGrams: 1.5, amountPaise: 1 })).toThrow(RangeError);
  });
});
