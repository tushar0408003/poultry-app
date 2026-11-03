import {
  computeSaleAmount,
  DecimalFormatError,
  kgToGrams,
  parseDecimal,
  paymentStatus,
  rupeesToPaise,
} from './money';

describe('money', () => {
  describe('parseDecimal', () => {
    it.each([
      ['200', 2, 20000],
      ['12.5', 2, 1250],
      [12.5, 2, 1250],
      ['0.01', 2, 1],
      [1.005, 3, 1005],
      [0.1, 2, 10],
      ['10.10', 2, 1010],
      ['7.000', 2, 700],
      ['  42 ', 2, 4200],
    ] as const)('parses %p at scale %p -> %p', (input, scale, expected) => {
      expect(parseDecimal(input, scale)).toBe(expected);
    });

    it('never multiplies floats (1.005 kg is exactly 1005 g)', () => {
      expect(1.005 * 1000).not.toBe(1005); // the float trap we avoid
      expect(kgToGrams(1.005)).toBe(1005);
      expect(() => rupeesToPaise(1.005)).toThrow(DecimalFormatError);
    });

    it.each(['abc', '1.2.3', '', '1e5', '.5'])('rejects %p', (input) => {
      expect(() => parseDecimal(input, 2)).toThrow(DecimalFormatError);
    });

    it('rejects too many decimal places', () => {
      expect(() => rupeesToPaise('1.234')).toThrow(/more than 2 decimal/);
    });
  });

  describe('computeSaleAmount', () => {
    it('matches the spec example: 50 kg x ₹200 = ₹10,000', () => {
      expect(computeSaleAmount(kgToGrams(50), rupeesToPaise(200))).toBe(1_000_000);
    });

    it('rounds half-up to the nearest paisa', () => {
      expect(computeSaleAmount(1005, 100)).toBe(101); // ₹1.005 -> ₹1.01
      expect(computeSaleAmount(1004, 100)).toBe(100); // ₹1.004 -> ₹1.00
    });

    it('is exact where floats are not (1.1 kg x ₹3)', () => {
      expect(1.1 * 3).not.toBe(3.3);
      expect(computeSaleAmount(kgToGrams(1.1), rupeesToPaise(3))).toBe(330);
    });

    it('handles fractional weights and rates', () => {
      // 12.345 kg x ₹199.99 = ₹2468.876... -> ₹2468.88
      expect(computeSaleAmount(12345, 19999)).toBe(246888);
    });
  });

  it('derives payment status', () => {
    expect(paymentStatus(1000, 0)).toBe('UNPAID');
    expect(paymentStatus(1000, 400)).toBe('PARTIAL');
    expect(paymentStatus(1000, 1000)).toBe('PAID');
  });
});
