import { calculateCommercialDiscount } from './calculateDiscount';
import { calculateCommercialInstallment } from './calculateInstallment';
import { calculateCommercialRevolving } from './calculateRevolving';
import { calculateCommercialSpot } from './calculateSpot';

const taxes = { bsmvRatePercent: 5, kkdfRatePercent: 0, otherTaxRatePercent: 0 };
const date = (value: string) => new Date(`${value}T12:00:00`);

describe('commercial calculations', () => {
  it('matches the official ACT/360 spot example and adds configured BSMV', () => {
    const result = calculateCommercialSpot({
      productType: 'commercial_spot', principal: 100_000,
      annualInterestRatePercent: 15, creditUsageDate: date('2026-01-01'),
      maturityDate: date('2026-01-31'), ...taxes,
    });
    expect(result.dayCount).toBe(30);
    expect(result.interest).toBe(1250);
    expect(result.bsmv).toBe(62.5);
    expect(result.maturityPayment).toBe(101312.5);
  });

  it('uses actual calendar days across leap day', () => {
    const result = calculateCommercialSpot({
      productType: 'commercial_spot', principal: 360_000,
      annualInterestRatePercent: 10, creditUsageDate: date('2024-02-28'),
      maturityDate: date('2024-03-01'), ...taxes,
    });
    expect(result.dayCount).toBe(2);
    expect(result.interest).toBe(200);
  });

  it('calculates revolving movement periods without average-balance shortcuts', () => {
    const result = calculateCommercialRevolving({
      productType: 'commercial_revolving', mode: 'movements',
      annualInterestRatePercent: 36, startDate: date('2026-09-01'),
      endDate: date('2026-10-01'), ...taxes,
      movements: [
        { date: date('2026-09-01'), amount: 500_000 },
        { date: date('2026-09-10'), amount: -100_000 },
        { date: date('2026-09-18'), amount: 200_000 },
        { date: date('2026-09-25'), amount: -300_000 },
      ],
    });
    expect(result.periods.map((period) => period.dayCount)).toEqual([9, 8, 7, 6]);
    expect(result.interest).toBe(13700);
    expect(result.bsmv).toBe(685);
    expect(result.closingBalance).toBe(300000);
  });

  it('matches the official revolving 1,000 TL / 30 day example', () => {
    const result = calculateCommercialRevolving({
      productType: 'commercial_revolving', mode: 'simple', principal: 1000,
      annualInterestRatePercent: 27, startDate: date('2026-01-01'),
      endDate: date('2026-01-31'), ...taxes,
    });
    expect(result.interest).toBe(22.5);
    expect(result.bsmv).toBe(1.13);
  });

  it('deducts interest and taxes from discount nominal amount', () => {
    const result = calculateCommercialDiscount({
      productType: 'commercial_discount', documentType: 'cheque',
      nominalAmount: 100_000, annualDiscountRatePercent: 18,
      transactionDate: date('2026-01-01'), maturityDate: date('2026-03-02'), ...taxes,
    });
    expect(result.dayCount).toBe(60);
    expect(result.interest).toBe(3000);
    expect(result.totalDeduction).toBe(3150);
    expect(result.netProceeds).toBe(96850);
  });

  it('creates a cent-balanced zero-interest installment schedule', () => {
    const result = calculateCommercialInstallment({
      productType: 'commercial_installment', principal: 1000,
      monthlyInterestRatePercent: 0, termMonths: 3, paymentFrequencyMonths: 1,
      creditUsageDate: date('2026-01-15'), firstInstallmentDate: date('2026-02-15'),
      ...taxes,
    });
    expect(result.schedule.map((row) => row.installment)).toEqual([333.33, 333.33, 333.34]);
    expect(result.totalRepayment).toBe(1000);
    expect(result.schedule.at(-1)?.remainingPrincipal).toBe(0);
  });

  it('rejects invalid date ranges and overpayments', () => {
    expect(() => calculateCommercialSpot({
      productType: 'commercial_spot', principal: 1, annualInterestRatePercent: 1,
      creditUsageDate: date('2026-02-01'), maturityDate: date('2026-01-01'), ...taxes,
    })).toThrow();
    expect(() => calculateCommercialRevolving({
      productType: 'commercial_revolving', mode: 'movements', annualInterestRatePercent: 1,
      startDate: date('2026-01-01'), endDate: date('2026-01-10'), ...taxes,
      movements: [{ date: date('2026-01-01'), amount: -1 }],
    })).toThrow();
  });

  describe('spot boundaries', () => {
    it.each([
      ['one day', '2026-01-01', '2026-01-02', 100],
      ['360 days', '2026-01-01', '2026-12-27', 36_000],
      ['daylight-saving boundary', '2026-03-28', '2026-03-30', 200],
    ])('uses ACT/360 for %s', (_, start, end, expectedInterest) => {
      const result = calculateCommercialSpot({
        productType: 'commercial_spot', principal: 360_000,
        annualInterestRatePercent: 10, creditUsageDate: date(start),
        maturityDate: date(end), bsmvRatePercent: 0, kkdfRatePercent: 0,
        otherTaxRatePercent: 0,
      });
      expect(result.interest).toBe(expectedInterest);
      expect(result.maturityPayment).toBe(360_000 + expectedInterest);
    });

    it('supports a zero rate without inventing a charge', () => {
      const result = calculateCommercialSpot({
        productType: 'commercial_spot', principal: 123.45,
        annualInterestRatePercent: 0, creditUsageDate: date('2026-01-01'),
        maturityDate: date('2026-01-02'), ...taxes,
      });
      expect(result).toMatchObject({ interest: 0, bsmv: 0, totalFinancingCost: 0, maturityPayment: 123.45 });
    });

    it('uses half-up cent rounding for interest and each tax independently', () => {
      const interestBoundary = calculateCommercialSpot({
        productType: 'commercial_spot', principal: 1, annualInterestRatePercent: 180,
        creditUsageDate: date('2026-01-01'), maturityDate: date('2026-01-02'),
        bsmvRatePercent: 0, kkdfRatePercent: 0, otherTaxRatePercent: 0,
      });
      const taxBoundary = calculateCommercialSpot({
        productType: 'commercial_spot', principal: 20, annualInterestRatePercent: 180,
        creditUsageDate: date('2026-01-01'), maturityDate: date('2026-01-02'),
        bsmvRatePercent: 5, kkdfRatePercent: 5, otherTaxRatePercent: 5,
      });
      expect(interestBoundary.interest).toBe(0.01);
      expect(taxBoundary).toMatchObject({ interest: 0.1, bsmv: 0.01, kkdf: 0.01, otherTax: 0.01, totalFinancingCost: 0.13 });
    });

    it.each([
      ['zero principal', { principal: 0 }],
      ['negative rate', { annualInterestRatePercent: -1 }],
      ['non-finite rate', { annualInterestRatePercent: Number.NaN }],
      ['negative tax', { bsmvRatePercent: -1 }],
      ['same date', { maturityDate: date('2026-01-01') }],
      ['excessive date range', { maturityDate: date('2037-01-02') }],
    ])('rejects %s', (_, override) => {
      expect(() => calculateCommercialSpot({
        productType: 'commercial_spot', principal: 1000,
        annualInterestRatePercent: 10, creditUsageDate: date('2026-01-01'),
        maturityDate: date('2026-02-01'), ...taxes, ...override,
      })).toThrow();
    });
  });

  describe('installment invariants', () => {
    const installmentInput = {
      productType: 'commercial_installment' as const,
      principal: 100_000, monthlyInterestRatePercent: 2,
      termMonths: 12, paymentFrequencyMonths: 1 as const,
      creditUsageDate: date('2026-01-31'), firstInstallmentDate: date('2026-02-28'),
      bsmvRatePercent: 0, kkdfRatePercent: 0, otherTaxRatePercent: 0,
    };

    it('matches the independent annuity formula and closes exactly at zero', () => {
      const result = calculateCommercialInstallment(installmentInput);
      expect(result.regularInstallment).toBe(9455.96);
      expect(result.schedule).toHaveLength(12);
      expect(result.schedule.at(-1)?.remainingPrincipal).toBe(0);
      expect(result.totalRepayment).toBe(
        Math.round((result.input.principal + result.totalFinancingCost) * 100) / 100
      );
      result.schedule.forEach((row) => {
        expect(row.installment).toBe(
          Math.round((row.principal + row.totalFinancingCost) * 100) / 100
        );
        expect(row.principal).toBeGreaterThanOrEqual(0);
        expect(row.remainingPrincipal).toBeGreaterThanOrEqual(0);
      });
    });

    it('matches Akbank official 100,000 TL / 36 month / 4.89% commercial example', () => {
      const result = calculateCommercialInstallment({
        productType: 'commercial_installment', principal: 100_000,
        monthlyInterestRatePercent: 4.89, termMonths: 36, paymentFrequencyMonths: 1,
        creditUsageDate: date('2026-01-01'), firstInstallmentDate: date('2026-02-01'),
        bsmvRatePercent: 5, kkdfRatePercent: 0, otherTaxRatePercent: 0,
      });
      expect(result.regularInstallment).toBe(6148.23);
      expect(result.totalRepayment).toBeCloseTo(221_336, 0);
    });

    it.each([1, 3, 6] as const)('reconciles every row for %s-month frequency', (frequency) => {
      const result = calculateCommercialInstallment({
        ...installmentInput, principal: 987_654.32, monthlyInterestRatePercent: 3.17,
        termMonths: 12, paymentFrequencyMonths: frequency,
        firstInstallmentDate: date(frequency === 1 ? '2026-02-28' : frequency === 3 ? '2026-04-30' : '2026-07-31'),
        bsmvRatePercent: 5, otherTaxRatePercent: 1.25,
      });
      expect(result.installmentCount).toBe(12 / frequency);
      expect(result.schedule.reduce((sum, row) => Math.round((sum + row.principal) * 100) / 100, 0)).toBe(987_654.32);
      expect(result.schedule.at(-1)?.remainingPrincipal).toBe(0);
      expect(result.schedule.every((row) => row.installment > 0 && row.interest >= 0)).toBe(true);
    });

    it('adds only the delayed broken-period cost to the first installment', () => {
      const regular = calculateCommercialInstallment(installmentInput);
      const delayed = calculateCommercialInstallment({ ...installmentInput, firstInstallmentDate: date('2026-03-10') });
      expect(delayed.brokenPeriodDays).toBe(10);
      expect(delayed.schedule[0].principal).toBe(regular.schedule[0].principal);
      expect(delayed.schedule[1].installment).toBe(regular.schedule[1].installment);
      expect(delayed.firstInstallment).toBeGreaterThan(regular.firstInstallment);
    });

    it('rejects incompatible frequency, invalid terms, dates and unsafe extreme results', () => {
      expect(() => calculateCommercialInstallment({ ...installmentInput, termMonths: 10, paymentFrequencyMonths: 3 })).toThrow();
      expect(() => calculateCommercialInstallment({ ...installmentInput, termMonths: 0 })).toThrow();
      expect(() => calculateCommercialInstallment({ ...installmentInput, firstInstallmentDate: installmentInput.creditUsageDate })).toThrow();
      expect(() => calculateCommercialInstallment({
        ...installmentInput, paymentFrequencyMonths: 6, termMonths: 12,
        creditUsageDate: date('2026-03-01'), firstInstallmentDate: date('2026-03-02'),
      })).toThrow('çok erkendir');
      expect(() => calculateCommercialInstallment({
        ...installmentInput, principal: 1_000_000_000_000,
        monthlyInterestRatePercent: 1000, termMonths: 360,
      })).toThrow('güvenli tutar sınırını');
    });
  });

  describe('revolving movement ledger', () => {
    it('groups same-day entries and uses only the net closing balance afterward', () => {
      const result = calculateCommercialRevolving({
        productType: 'commercial_revolving', mode: 'movements', annualInterestRatePercent: 36,
        startDate: date('2026-01-01'), endDate: date('2026-01-11'), ...taxes,
        movements: [
          { date: date('2026-01-01'), amount: 1000 },
          { date: date('2026-01-01'), amount: 500 },
          { date: date('2026-01-06'), amount: -500 },
        ],
      });
      expect(result.periods.map((period) => [period.openingBalance, period.dayCount])).toEqual([[1500, 5], [1000, 5]]);
      expect(result.interest).toBe(12.5);
      expect(result.closingBalance).toBe(1000);
    });

    it('rounds accumulated sub-cent interest once and reconciles displayed periods', () => {
      const result = calculateCommercialRevolving({
        productType: 'commercial_revolving', mode: 'movements', annualInterestRatePercent: 1,
        startDate: date('2026-01-01'), endDate: date('2026-01-04'),
        bsmvRatePercent: 0, kkdfRatePercent: 0, otherTaxRatePercent: 0,
        movements: [
          { date: date('2026-01-01'), amount: 100 },
          { date: date('2026-01-02'), amount: 100 },
          { date: date('2026-01-03'), amount: 100 },
        ],
      });
      expect(result.interest).toBe(0.02);
      expect(result.periods.reduce((sum, period) => Math.round((sum + period.interest) * 100) / 100, 0)).toBe(result.interest);
    });

    it('allows full repayment and a zero balance without charging later days', () => {
      const result = calculateCommercialRevolving({
        productType: 'commercial_revolving', mode: 'movements', annualInterestRatePercent: 36,
        startDate: date('2026-01-01'), endDate: date('2026-01-21'), ...taxes,
        movements: [{ date: date('2026-01-01'), amount: 1000 }, { date: date('2026-01-11'), amount: -1000 }],
      });
      expect(result.closingBalance).toBe(0);
      expect(result.periods).toHaveLength(1);
      expect(result.interest).toBe(10);
    });

    it.each([
      ['empty ledger', []],
      ['zero movement', [{ date: date('2026-01-01'), amount: 0 }]],
      ['movement before range', [{ date: date('2025-12-31'), amount: 1 }]],
      ['movement after range', [{ date: date('2026-02-02'), amount: 1 }]],
      ['unsafe movement', [{ date: date('2026-01-01'), amount: 1_000_000_000_001 }]],
    ])('rejects %s', (_, movements) => {
      expect(() => calculateCommercialRevolving({
        productType: 'commercial_revolving', mode: 'movements', annualInterestRatePercent: 10,
        startDate: date('2026-01-01'), endDate: date('2026-02-01'), movements, ...taxes,
      })).toThrow();
    });

    it('rejects an unknown runtime mode', () => {
      expect(() => calculateCommercialRevolving({
        productType: 'commercial_revolving', mode: 'unknown' as never,
        annualInterestRatePercent: 10, startDate: date('2026-01-01'),
        endDate: date('2026-02-01'), ...taxes,
      })).toThrow('biçimi');
    });
  });

  describe('discount boundaries', () => {
    it('supports the TCMB convention that includes the discount day', () => {
      const result = calculateCommercialDiscount({
        productType: 'commercial_discount', documentType: 'cheque', nominalAmount: 360_000,
        annualDiscountRatePercent: 10, transactionDate: date('2026-01-01'),
        maturityDate: date('2026-01-31'), includeTransactionDay: true,
        bsmvRatePercent: 0, kkdfRatePercent: 0, otherTaxRatePercent: 0,
      });
      expect(result.dayCount).toBe(31);
      expect(result.interest).toBe(3100);
    });

    it('returns nominal value at zero rate for both supported document types', () => {
      for (const documentType of ['cheque', 'promissory_note'] as const) {
        const result = calculateCommercialDiscount({
          productType: 'commercial_discount', documentType, nominalAmount: 1000,
          annualDiscountRatePercent: 0, transactionDate: date('2026-01-01'),
          maturityDate: date('2026-01-02'), ...taxes,
        });
        expect(result.netProceeds).toBe(1000);
        expect(result.totalDeduction).toBe(0);
      }
    });

    it('rejects a deduction that consumes the nominal amount', () => {
      expect(() => calculateCommercialDiscount({
        productType: 'commercial_discount', documentType: 'cheque', nominalAmount: 1000,
        annualDiscountRatePercent: 1000, transactionDate: date('2026-01-01'),
        maturityDate: date('2027-01-01'), bsmvRatePercent: 5,
        kkdfRatePercent: 0, otherTaxRatePercent: 0,
      })).toThrow('nominal tutardan küçük');
    });

    it('rejects an unknown document type', () => {
      expect(() => calculateCommercialDiscount({
        productType: 'commercial_discount', documentType: 'invoice' as never,
        nominalAmount: 1000, annualDiscountRatePercent: 10,
        transactionDate: date('2026-01-01'), maturityDate: date('2026-02-01'),
        ...taxes,
      })).toThrow('Belge türü');
    });
  });
});
