import { calculateDeposit } from '../calculateDeposit';

const startDate = new Date(2026, 7, 20);

describe('calculateDeposit', () => {
  it('accrues simple interest on a 365-day basis', () => {
    const result = calculateDeposit({
      principal: 100000,
      annualInterestRatePercent: 45,
      termDays: 32,
      withholdingTaxRatePercent: 0,
      startDate,
    });

    // 100.000 × 0,45 × 32 / 365
    expect(result.grossInterest).toBe(3945.21);
    expect(result.netInterest).toBe(3945.21);
    expect(result.maturityAmount).toBe(103945.21);
  });

  it('withholds tax from the gross interest only, never from the principal', () => {
    const result = calculateDeposit({
      principal: 100000,
      annualInterestRatePercent: 45,
      termDays: 32,
      withholdingTaxRatePercent: 7.5,
      startDate,
    });

    expect(result.grossInterest).toBe(3945.21);
    expect(result.withholdingTax).toBe(295.89);
    expect(result.netInterest).toBe(3649.32);
    expect(result.maturityAmount).toBe(103649.32);
  });

  it('keeps gross, tax and net reconciled to the cent', () => {
    const result = calculateDeposit({
      principal: 33333.33,
      annualInterestRatePercent: 41.75,
      termDays: 91,
      withholdingTaxRatePercent: 5,
      startDate,
    });

    expect(result.grossInterest - result.withholdingTax).toBeCloseTo(
      result.netInterest,
      2
    );
    expect(result.principal + result.netInterest).toBeCloseTo(
      result.maturityAmount,
      2
    );
  });

  it('reports the net return as an annualised rate', () => {
    const result = calculateDeposit({
      principal: 50000,
      annualInterestRatePercent: 40,
      termDays: 365,
      withholdingTaxRatePercent: 10,
      startDate,
    });

    expect(result.effectiveAnnualNetRatePercent).toBeCloseTo(36, 2);
  });

  it('sets the maturity date the term away from the start date', () => {
    const result = calculateDeposit({
      principal: 10000,
      annualInterestRatePercent: 40,
      termDays: 92,
      withholdingTaxRatePercent: 7.5,
      startDate,
    });

    expect(result.maturityDate).toEqual(new Date(2026, 10, 20));
  });

  it('ignores a fractional term rather than paying interest for part of a day', () => {
    const result = calculateDeposit({
      principal: 10000,
      annualInterestRatePercent: 40,
      termDays: 32.9,
      withholdingTaxRatePercent: 0,
      startDate,
    });

    expect(result.termDays).toBe(32);
  });

  it('returns no interest at a zero rate but keeps the principal intact', () => {
    const result = calculateDeposit({
      principal: 25000,
      annualInterestRatePercent: 0,
      termDays: 45,
      withholdingTaxRatePercent: 7.5,
      startDate,
    });

    expect(result.grossInterest).toBe(0);
    expect(result.withholdingTax).toBe(0);
    expect(result.maturityAmount).toBe(25000);
  });

  it('rejects inputs that cannot describe a deposit', () => {
    expect(() =>
      calculateDeposit({
        principal: 0,
        annualInterestRatePercent: 40,
        termDays: 32,
        withholdingTaxRatePercent: 7.5,
        startDate,
      })
    ).toThrow('Anapara');

    expect(() =>
      calculateDeposit({
        principal: 10000,
        annualInterestRatePercent: 40,
        termDays: 0,
        withholdingTaxRatePercent: 7.5,
        startDate,
      })
    ).toThrow('Vade');

    expect(() =>
      calculateDeposit({
        principal: 10000,
        annualInterestRatePercent: 40,
        termDays: 32,
        withholdingTaxRatePercent: 120,
        startDate,
      })
    ).toThrow('Stopaj');
  });
});
