import {
  buildDepositAnalyticsEvent,
  buildCommercialAnalyticsEvent,
  buildLoanAnalyticsEvent,
} from '../calculationEvents';

describe('calculation analytics events', () => {
  it('normalizes loan type and excludes schedules and dates', () => {
    const event = buildLoanAnalyticsEvent({
      loanType: 'Bireysel Konut Kredisi',
      input: {
        principal: 1_000_000,
        term: 120,
        monthlyInterestRatePercent: 2.5,
        kkdfRatePercent: 0,
        bsmvRatePercent: 0,
        creditUsageDate: new Date('2026-01-01'),
        firstInstallmentDate: new Date('2026-02-01'),
      },
      result: {
        input: {} as never,
        planType: 'standard',
        standardInstallment: 10,
        firstInstallment: 10,
        totalPayment: 1200,
        totalPrincipal: 1000,
        totalInterest: 200,
        totalKkdf: 0,
        totalBsmv: 0,
        schedule: [],
        brokenPeriod: {} as never,
        deductFirstInstallmentDelayFromTerm: false,
        firstInstallmentDelayMonths: 0,
        deductedDelayMonths: 0,
        effectiveInstallmentCount: 120,
      },
    });
    expect(event.variant).toBe('housing/standard');
    expect(JSON.stringify(event)).not.toContain('2026-01-01');
    expect(JSON.stringify(event)).not.toContain('schedule');
  });

  it('builds a compact deposit summary', () => {
    const event = buildDepositAnalyticsEvent({
      principal: 1000,
      termDays: 32,
      annualInterestRatePercent: 40,
      withholdingTaxRatePercent: 15,
      grossInterest: 35,
      withholdingTax: 5,
      netInterest: 30,
      maturityAmount: 1030,
      maturityDate: new Date('2026-02-02'),
      effectiveAnnualNetRatePercent: 34,
    });
    expect(event.metrics.resultNetReturn).toBe(30);
    expect(JSON.stringify(event)).not.toContain('maturityDate');
  });

  it('builds a privacy-safe commercial summary without movements or dates', () => {
    const event = buildCommercialAnalyticsEvent({
      productType: 'commercial_revolving', totalDays: 30, closingBalance: 300000,
      periods: [{ startDate: new Date('2026-01-01'), endDate: new Date('2026-01-31'), openingBalance: 300000, dayCount: 30, interest: 9000 }],
      interest: 9000, bsmv: 450, kkdf: 0, otherTax: 0, totalFinancingCost: 9450,
      dayCountConvention: 'ACT/360',
      input: { productType: 'commercial_revolving', mode: 'movements', annualInterestRatePercent: 36, startDate: new Date('2026-01-01'), endDate: new Date('2026-01-31'), bsmvRatePercent: 5, kkdfRatePercent: 0, otherTaxRatePercent: 0, movements: [{ date: new Date('2026-01-01'), amount: 300000 }] },
    });
    expect(event.variant).toBe('commercial_revolving');
    expect(event.attributes).toEqual({ commercialMode: 'movements' });
    expect(JSON.stringify(event)).not.toContain('openingBalance');
    expect(JSON.stringify(event)).not.toContain('2026-01-01');
  });

  it('uses peak revolving exposure after the account is fully repaid', () => {
    const event = buildCommercialAnalyticsEvent({
      productType: 'commercial_revolving', totalDays: 10, closingBalance: 0,
      periods: [], interest: 0, bsmv: 0, kkdf: 0, otherTax: 0,
      totalFinancingCost: 0, dayCountConvention: 'ACT/360',
      input: { productType: 'commercial_revolving', mode: 'movements', annualInterestRatePercent: 0, startDate: new Date('2026-01-01'), endDate: new Date('2026-01-11'), bsmvRatePercent: 5, kkdfRatePercent: 0, otherTaxRatePercent: 0, movements: [{ date: new Date('2026-01-01'), amount: 100000 }, { date: new Date('2026-01-10'), amount: -100000 }] },
    });
    expect(event.metrics.principalAmount).toBe(100000);
    expect(event.metrics.resultTotal).toBe(100000);
  });
});
