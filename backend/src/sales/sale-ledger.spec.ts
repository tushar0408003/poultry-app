import { computeTotals } from './sale-ledger.service';

describe('computeTotals', () => {
  it('returns rupees, with remaining exactly 0 when fully paid (no float drift)', () => {
    // ₹0.30 paid as ₹0.10 + ₹0.20: in float rupees 0.3 - (0.1 + 0.2) is -5.55e-17.
    expect(computeTotals(30, 10, 20)).toEqual({ cashPaid: 0.1, onlinePaid: 0.2, totalPaid: 0.3, remaining: 0 });
  });

  it('returns the due amount in rupees', () => {
    expect(computeTotals(175000, 50000, 0)).toEqual({ cashPaid: 500, onlinePaid: 0, totalPaid: 500, remaining: 1250 });
  });
});
