import { describe, expect, it } from 'vitest';
import { kgToGrams, rupeesToPaise } from '../common/money';
import { purchaseTotalPaise } from './purchases.service';

const total = (kg: string, rate: string) => purchaseTotalPaise(kgToGrams(kg), rupeesToPaise(rate));

describe('purchaseTotalPaise', () => {
  it('multiplies weight by rate exactly', () => {
    expect(total('100', '95')).toBe(950_000);
    expect(total('250.5', '95.5')).toBe(2_392_275);
  });

  it('rounds to the nearest paisa', () => {
    expect(total('0.001', '0.01')).toBe(0); // 0.00001 paise
    expect(total('1.005', '1')).toBe(101); // 100.5 paise -> 101
    expect(total('0.333', '3')).toBe(100); // 99.9 paise -> 100
  });
});
