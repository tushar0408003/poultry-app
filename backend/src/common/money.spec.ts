import {
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

  it('derives payment status', () => {
    expect(paymentStatus(1000, 0)).toBe('UNPAID');
    expect(paymentStatus(1000, 400)).toBe('PARTIAL');
    expect(paymentStatus(1000, 1000)).toBe('PAID');
  });
});
