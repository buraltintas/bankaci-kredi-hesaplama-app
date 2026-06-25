import { calculateLoan } from '../calculateLoan';

const baseInput = {
  principal: 100000,
  term: 12,
  monthlyInterestRatePercent: 3,
  kkdfRatePercent: 15,
  bsmvRatePercent: 15,
  creditUsageDate: new Date(2026, 5, 1),
  firstInstallmentDate: new Date(2026, 6, 1),
};

const amountTolerance = 1;
const totalPaymentTolerance = 2;
const finalPrincipalTolerance = 0.01;
const rateTolerancePercent = 0.001;

const expectCloseWithin = (
  actual: number,
  expected: number,
  tolerance: number
) => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
};

const sumSchedule = (
  schedule: ReturnType<typeof calculateLoan>['schedule'],
  key: 'installment' | 'principal' | 'interest' | 'kkdf' | 'bsmv'
) =>
  Number(
    schedule
      .reduce((total, item) => total + item[key], 0)
      .toFixed(2)
  );

describe('calculateLoan', () => {
  it('generates a standard equal installment schedule', () => {
    const result = calculateLoan(baseInput);

    expect(result.planType).toBe('standard');
    expect(result.brokenPeriod.diffDays).toBe(0);
    expect(result.firstInstallment).toBe(result.standardInstallment);
    expect(result.schedule).toHaveLength(12);
    expect(result.schedule[11].remainingPrincipal).toBe(0);
    expect(
      result.schedule
        .slice(0, -1)
        .every((item) => item.installment === result.standardInstallment)
    ).toBe(true);
    expect(
      Math.abs(result.schedule[11].installment - result.standardInstallment)
    ).toBeLessThan(0.1);
  });

  it('applies late broken period only to the first installment', () => {
    const standardResult = calculateLoan(baseInput);
    const result = calculateLoan({
      ...baseInput,
      firstInstallmentDate: new Date(2026, 6, 15),
    });

    expect(result.brokenPeriod.diffDays).toBe(14);
    expect(result.firstInstallment).toBeGreaterThan(result.standardInstallment);
    expect(result.schedule[1].installment).toBe(result.standardInstallment);
    expect(result.schedule[2].installment).toBe(result.standardInstallment);
    expect(result.schedule.map((item) => item.principal)).toEqual(
      standardResult.schedule.map((item) => item.principal)
    );
    expect(result.schedule.map((item) => item.remainingPrincipal)).toEqual(
      standardResult.schedule.map((item) => item.remainingPrincipal)
    );
  });

  it('applies early broken period only to the first installment', () => {
    const standardResult = calculateLoan(baseInput);
    const result = calculateLoan({
      ...baseInput,
      firstInstallmentDate: new Date(2026, 5, 20),
    });

    expect(result.brokenPeriod.diffDays).toBe(-11);
    expect(result.firstInstallment).toBeLessThan(result.standardInstallment);
    expect(result.schedule[1].installment).toBe(result.standardInstallment);
    expect(result.schedule.map((item) => item.principal)).toEqual(
      standardResult.schedule.map((item) => item.principal)
    );
    expect(result.schedule.map((item) => item.remainingPrincipal)).toEqual(
      standardResult.schedule.map((item) => item.remainingPrincipal)
    );
  });

  it('keeps following installment dates monthly from selected first date', () => {
    const result = calculateLoan({
      ...baseInput,
      creditUsageDate: new Date(2025, 11, 31),
      firstInstallmentDate: new Date(2026, 0, 31),
    });

    expect(result.schedule[0].date).toEqual(new Date(2026, 0, 31));
    expect(result.schedule[1].date).toEqual(new Date(2026, 1, 28));
    expect(result.schedule[2].date).toEqual(new Date(2026, 2, 31));
  });

  it('rejects first installment dates before credit usage date', () => {
    expect(() =>
      calculateLoan({
        ...baseInput,
        firstInstallmentDate: new Date(2026, 4, 31),
      })
    ).toThrow('İlk taksit tarihi');
  });

  it('keeps KKDF and BSMV totals in the standard plan', () => {
    const result = calculateLoan(baseInput);

    expect(result.totalKkdf).toBeGreaterThan(0);
    expect(result.totalBsmv).toBeGreaterThan(0);
    expect(result.schedule.every((item) => item.kkdf > 0 && item.bsmv > 0)).toBe(
      true
    );
  });

  it('matches the prepaid interest reference case approximately', () => {
    const result = calculateLoan({
      principal: 1000000,
      term: 36,
      monthlyInterestRatePercent: 3.1,
      kkdfRatePercent: 0,
      bsmvRatePercent: 0,
      creditUsageDate: new Date(2026, 5, 24),
      firstInstallmentDate: new Date(2026, 6, 24),
      planType: 'prepaidInterest',
      prepaidInterestAmount: 50000,
    });

    const upfrontRow = result.schedule[0];
    const lastRow = result.schedule[result.schedule.length - 1];

    expect(result.planType).toBe('prepaidInterest');
    expect(result.discountedMonthlyRate).toBeCloseTo(0.02759, 5);
    expect(result.standardInstallment).toBeCloseTo(44171.69, 2);
    expect(upfrontRow.installmentNumber).toBe(0);
    expect(upfrontRow.isPrepaidInterest).toBe(true);
    expect(upfrontRow.installment).toBeCloseTo(49862.68, 0);
    expect(upfrontRow.principal).toBe(0);
    expect(upfrontRow.remainingPrincipal).toBe(1000000);
    expect(result.totalInterest).toBeCloseTo(640043.52, 0);
    expect(result.totalPayment).toBeCloseTo(1640043.52, 0);
    expect(result.totalPrincipal).toBe(1000000);
    expect(lastRow.remainingPrincipal).toBe(0);
  });

  it('rejects invalid prepaid interest amounts', () => {
    expect(() =>
      calculateLoan({
        ...baseInput,
        planType: 'prepaidInterest',
        prepaidInterestAmount: -1000,
      })
    ).toThrow('Peşin faiz');

    expect(() =>
      calculateLoan({
        ...baseInput,
        planType: 'prepaidInterest',
        prepaidInterestAmount: 0,
      })
    ).toThrow('Peşin faiz');

    expect(() =>
      calculateLoan({
        ...baseInput,
        planType: 'prepaidInterest',
        prepaidInterestAmount: baseInput.principal,
      })
    ).toThrow();

    expect(() =>
      calculateLoan({
        ...baseInput,
        planType: 'prepaidInterest',
        prepaidInterestAmount: baseInput.principal + 1,
      })
    ).toThrow();
  });

  it('rejects prepaid interest above the maximum applicable amount', () => {
    expect(() =>
      calculateLoan({
        principal: 100000,
        term: 12,
        monthlyInterestRatePercent: 3,
        kkdfRatePercent: 0,
        bsmvRatePercent: 0,
        creditUsageDate: new Date(2026, 5, 24),
        firstInstallmentDate: new Date(2026, 6, 24),
        planType: 'prepaidInterest',
        prepaidInterestAmount: 90000,
      })
    ).toThrow('azami peşin faiz tutarı yaklaşık 17.050,01 TL');
  });

  it('allows prepaid interest just below the maximum applicable amount', () => {
    const result = calculateLoan({
      principal: 100000,
      term: 12,
      monthlyInterestRatePercent: 3,
      kkdfRatePercent: 0,
      bsmvRatePercent: 0,
      creditUsageDate: new Date(2026, 5, 24),
      firstInstallmentDate: new Date(2026, 6, 24),
      planType: 'prepaidInterest',
      prepaidInterestAmount: 17049,
    });
    const upfrontRow = result.schedule[0];
    const lastRow = result.schedule[result.schedule.length - 1];

    expect(result.planType).toBe('prepaidInterest');
    expect((result.discountedMonthlyRate ?? 0) * 100).toBeGreaterThanOrEqual(0);
    expect(upfrontRow.installmentNumber).toBe(0);
    expect(upfrontRow.isPrepaidInterest).toBe(true);
    expect(upfrontRow.installment).not.toBeCloseTo(22497.54, 2);
    expect(result.standardInstallment).toBeGreaterThan(0);
    expect(result.totalPrincipal).toBe(100000);
    expect(lastRow.remainingPrincipal).toBe(0);
  });

  it('keeps broken period adjustment on the first regular prepaid-interest installment', () => {
    const result = calculateLoan({
      principal: 1000000,
      term: 36,
      monthlyInterestRatePercent: 3.1,
      kkdfRatePercent: 0,
      bsmvRatePercent: 0,
      creditUsageDate: new Date(2026, 5, 24),
      firstInstallmentDate: new Date(2026, 7, 24),
      planType: 'prepaidInterest',
      prepaidInterestAmount: 50000,
    });
    const upfrontRow = result.schedule[0];
    const firstRegularRow = result.schedule[1];
    const secondRegularRow = result.schedule[2];
    const lastRow = result.schedule[result.schedule.length - 1];

    expect(result.schedule).toHaveLength(37);
    expect(upfrontRow.installmentNumber).toBe(0);
    expect(upfrontRow.isPrepaidInterest).toBe(true);
    expect(upfrontRow.installment).toBe(result.realizedPrepaidInterest);
    expect(upfrontRow.remainingPrincipal).toBe(1000000);
    expect(result.brokenPeriod.diffDays).toBeGreaterThan(0);
    expect(firstRegularRow.installment).toBeGreaterThan(result.standardInstallment);
    expect(secondRegularRow.installment).toBe(result.standardInstallment);
    expect(result.totalPrincipal).toBe(1000000);
    expect(Math.abs(lastRow.remainingPrincipal)).toBeLessThanOrEqual(
      finalPrincipalTolerance
    );
  });

  describe('prepaid interest validation matrix', () => {
    const cases = [
      {
        name: 'İş Bankası reference case',
        input: {
          principal: 1000000,
          term: 36,
          monthlyInterestRatePercent: 3.1,
          prepaidInterestAmount: 50000,
          kkdfRatePercent: 0,
          bsmvRatePercent: 0,
        },
        expected: {
          discountedRatePercent: 2.759,
          monthlyInstallment: 44171.69,
          upfrontInterest: 49862.68,
          totalPayment: 1640043.52,
        },
      },
      {
        name: 'same loan with higher prepaid interest',
        input: {
          principal: 1000000,
          term: 36,
          monthlyInterestRatePercent: 3.1,
          prepaidInterestAmount: 100000,
          kkdfRatePercent: 0,
          bsmvRatePercent: 0,
        },
        expected: {
          discountedRatePercent: 2.407,
          monthlyInstallment: 41842.64,
          upfrontInterest: 99960.83,
          totalPayment: 1606295.78,
        },
      },
      {
        name: 'taxed short to medium term',
        input: {
          principal: 500000,
          term: 24,
          monthlyInterestRatePercent: 4.2,
          prepaidInterestAmount: 25000,
          kkdfRatePercent: 15,
          bsmvRatePercent: 15,
        },
        expected: {
          discountedRatePercent: 3.791,
          monthlyInstallment: 35983.14,
          upfrontInterest: 24960.62,
          totalPayment: 896044.13,
        },
      },
      {
        name: 'long term tax free',
        input: {
          principal: 750000,
          term: 48,
          monthlyInterestRatePercent: 2.75,
          prepaidInterestAmount: 60000,
          kkdfRatePercent: 0,
          bsmvRatePercent: 0,
        },
        expected: {
          discountedRatePercent: 2.319,
          monthlyInstallment: 26065.35,
          upfrontInterest: 59921.7,
          totalPayment: 1311058.4,
        },
      },
      {
        name: 'taxed high principal short term',
        input: {
          principal: 800000,
          term: 18,
          monthlyInterestRatePercent: 3.75,
          prepaidInterestAmount: 40000,
          kkdfRatePercent: 15,
          bsmvRatePercent: 15,
        },
        expected: {
          discountedRatePercent: 3.254,
          monthlyInstallment: 64382.73,
          upfrontInterest: 39988.17,
          totalPayment: 1210873.77,
        },
      },
    ];

    it.each(cases)('$name', ({ input, expected }) => {
      const result = calculateLoan({
        ...input,
        creditUsageDate: new Date(2026, 5, 24),
        firstInstallmentDate: new Date(2026, 6, 24),
        planType: 'prepaidInterest',
      });
      const upfrontRow = result.schedule[0];
      const regularRows = result.schedule.slice(1);
      const lastRow = result.schedule[result.schedule.length - 1];

      expect(result.planType).toBe('prepaidInterest');
      expect(upfrontRow.installmentNumber).toBe(0);
      expect(upfrontRow.isPrepaidInterest).toBe(true);
      expect(upfrontRow.principal).toBe(0);
      expect(upfrontRow.remainingPrincipal).toBe(input.principal);
      expect(regularRows).toHaveLength(input.term);
      expect(
        regularRows
          .slice(0, -1)
          .every((item) => item.installment === result.standardInstallment)
      ).toBe(true);
      expectCloseWithin(
        Math.abs(lastRow.remainingPrincipal),
        0,
        finalPrincipalTolerance
      );
      expect(result.totalPrincipal).toBe(input.principal);
      expectCloseWithin(
        (result.discountedMonthlyRate ?? 0) * 100,
        expected.discountedRatePercent,
        rateTolerancePercent
      );
      expectCloseWithin(
        result.standardInstallment,
        expected.monthlyInstallment,
        amountTolerance
      );
      expectCloseWithin(
        upfrontRow.interest,
        expected.upfrontInterest,
        amountTolerance
      );
      expect(upfrontRow.kkdf).toBeCloseTo(
        upfrontRow.interest * (input.kkdfRatePercent / 100),
        2
      );
      expect(upfrontRow.bsmv).toBeCloseTo(
        upfrontRow.interest * (input.bsmvRatePercent / 100),
        2
      );
      expect(upfrontRow.installment).toBe(
        Number(
          (upfrontRow.interest + upfrontRow.kkdf + upfrontRow.bsmv).toFixed(2)
        )
      );
      expect(result.totalPayment).toBe(sumSchedule(result.schedule, 'installment'));
      expect(result.totalPrincipal).toBe(sumSchedule(result.schedule, 'principal'));
      expect(result.totalInterest).toBe(sumSchedule(result.schedule, 'interest'));
      expect(result.totalKkdf).toBe(sumSchedule(result.schedule, 'kkdf'));
      expect(result.totalBsmv).toBe(sumSchedule(result.schedule, 'bsmv'));
      expectCloseWithin(
        result.totalPayment,
        expected.totalPayment,
        totalPaymentTolerance
      );
    });
  });
});
