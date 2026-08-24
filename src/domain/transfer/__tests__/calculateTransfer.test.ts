import {
  compareFromEstimate,
  compareFromPayoff,
  suggestCompensationRate,
} from '../calculateTransfer';

describe('suggestCompensationRate', () => {
  it('caps at 1% up to 36 months and 2% beyond', () => {
    expect(suggestCompensationRate(36)).toBe(1);
    expect(suggestCompensationRate(37)).toBe(2);
    expect(suggestCompensationRate(120)).toBe(2);
  });
});

describe('compareFromPayoff', () => {
  it('adds compensation on top when the payoff excludes it', () => {
    const result = compareFromPayoff({
      payoffAmount: 1000000,
      commissionIncluded: false,
      compensationRatePercent: 2,
      currentMonthlyRatePercent: 4,
      newMonthlyRatePercent: 3,
      remainingTerm: 60,
    });

    expect(result.remainingPrincipal).toBe(1000000);
    expect(result.compensation).toBe(20000);
    expect(result.refinancePrincipal).toBe(1020000);
    // A lower rate over the same term should beat the old loan despite the fee.
    expect(result.savings).toBeGreaterThan(0);
  });

  it('backs compensation out when the payoff already includes it', () => {
    const result = compareFromPayoff({
      payoffAmount: 1020000,
      commissionIncluded: true,
      compensationRatePercent: 2,
      currentMonthlyRatePercent: 4,
      newMonthlyRatePercent: 3,
      remainingTerm: 60,
    });

    expect(result.remainingPrincipal).toBe(1000000);
    expect(result.compensation).toBe(20000);
    expect(result.refinancePrincipal).toBe(1020000);
  });

  it('reports a loss when the new rate is not low enough to cover the fee', () => {
    const result = compareFromPayoff({
      payoffAmount: 500000,
      commissionIncluded: false,
      compensationRatePercent: 2,
      currentMonthlyRatePercent: 3,
      newMonthlyRatePercent: 3,
      remainingTerm: 48,
    });

    // Same rate, plus a 2% fee financed over the term -> strictly worse.
    expect(result.savings).toBeLessThan(0);
  });
});

describe('compareFromEstimate', () => {
  it('derives the remaining balance from the amortization schedule', () => {
    const result = compareFromEstimate({
      originalPrincipal: 2000000,
      originalTerm: 120,
      remainingInstallments: 90,
      compensationRatePercent: 2,
      currentMonthlyRatePercent: 4,
      newMonthlyRatePercent: 3,
    });

    // 30 of 120 paid: most of the principal still stands early in an annuity.
    expect(result.remainingPrincipal).toBeGreaterThan(1800000);
    expect(result.remainingPrincipal).toBeLessThan(2000000);
    expect(result.compensation).toBeCloseTo(
      result.remainingPrincipal * 0.02,
      0
    );
    expect(result.remainingTerm).toBe(90);
  });

  it('keeps compensation, balance and refinance principal reconciled', () => {
    const result = compareFromEstimate({
      originalPrincipal: 1500000,
      originalTerm: 96,
      remainingInstallments: 60,
      compensationRatePercent: 2,
      currentMonthlyRatePercent: 3.5,
      newMonthlyRatePercent: 2.8,
    });

    expect(result.refinancePrincipal).toBeCloseTo(
      result.remainingPrincipal + result.compensation,
      2
    );
    // savings is derived from the unrounded totals, so allow a rounding cent.
    expect(result.savings).toBeCloseTo(
      result.currentTotal - result.newTotal,
      1
    );
  });

  it('rejects a remaining count greater than the original term', () => {
    expect(() =>
      compareFromEstimate({
        originalPrincipal: 1000000,
        originalTerm: 60,
        remainingInstallments: 61,
        compensationRatePercent: 2,
        currentMonthlyRatePercent: 3,
        newMonthlyRatePercent: 2.5,
      })
    ).toThrow('Kalan taksit');
  });
});
