import { formatINR, formatKg, parseDecimal, saleDuePaise, salePaidPaise, toGrams, toPaise } from '../money';

describe('money (client)', () => {
  it('parses decimal strings exactly', () => {
    expect(toPaise('200')).toBe(20000);
    expect(toPaise('12.5')).toBe(1250);
    expect(toPaise('12.')).toBe(1200);
    expect(toGrams('1.005')).toBe(1005);
    expect(toPaise('1.005')).toBeNull();
    expect(toPaise('')).toBeNull();
    expect(toPaise('-1')).toBeNull();
    expect(parseDecimal('abc', 2)).toBeNull();
  });

  it('formats Indian currency', () => {
    expect(formatINR(10000)).toBe('₹10,000');
    expect(formatINR(1234567.5)).toBe('₹12,34,567.50');
    expect(formatINR(999)).toBe('₹999');
    expect(formatINR(0)).toBe('₹0');
    expect(formatINR(-2500)).toBe('-₹2,500');
    expect(formatINR(0.1 + 0.2)).toBe('₹0.30');
  });

  it('formats weight', () => {
    expect(formatKg(50)).toBe('50 kg');
    expect(formatKg(1250.5)).toBe('1,250.5 kg');
    expect(formatKg(0.125)).toBe('0.125 kg');
  });
});

describe('derived sale amounts', () => {
  const sale = { totalAmount: 2468.88, cashReceived: 1000.1, onlineReceived: 200.2 };
  it('derives paid / due exactly in paise', () => {
    expect(salePaidPaise(sale)).toBe(120030);
    expect(saleDuePaise(sale)).toBe(126858);
  });
});
