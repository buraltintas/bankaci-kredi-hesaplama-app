import {
  buildDepositAnalyticsEvent,
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
});
