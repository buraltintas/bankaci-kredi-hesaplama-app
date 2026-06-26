import { calculateLoan } from '../calculateLoan';
import type { LoanInput } from '../types';
import { addMonths } from '../../../utils/dateMath';

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

const expectFiniteNonNegativeZero = (value: number) => {
  expect(Number.isFinite(value)).toBe(true);
  expect(Object.is(value, -0)).toBe(false);
};

const expectResultTotalsToMatchSchedule = (
  result: ReturnType<typeof calculateLoan>
) => {
  expect(result.totalPayment).toBe(sumSchedule(result.schedule, 'installment'));
  expect(result.totalPrincipal).toBe(sumSchedule(result.schedule, 'principal'));
  expect(result.totalInterest).toBe(sumSchedule(result.schedule, 'interest'));
  expect(result.totalKkdf).toBe(sumSchedule(result.schedule, 'kkdf'));
  expect(result.totalBsmv).toBe(sumSchedule(result.schedule, 'bsmv'));
  [
    result.standardInstallment,
    result.firstInstallment,
    result.totalPayment,
    result.totalPrincipal,
    result.totalInterest,
    result.totalKkdf,
    result.totalBsmv,
  ].forEach(expectFiniteNonNegativeZero);
  result.schedule.forEach((item) => {
    [
      item.installment,
      item.principal,
      item.interest,
      item.kkdf,
      item.bsmv,
      item.remainingPrincipal,
    ].forEach(expectFiniteNonNegativeZero);
  });
};

const expectScheduleDatesToFollowFirstInstallment = (
  result: ReturnType<typeof calculateLoan>
) => {
  result.schedule.forEach((item) => {
    if (item.isPrepaidInterest) {
      expect(item.date).toEqual(result.input.creditUsageDate);
      return;
    }

    expect(item.date).toEqual(
      addMonths(result.input.firstInstallmentDate, item.installmentNumber - 1)
    );
  });
};

const expectBrokenPeriodSafetyInvariants = (
  input: LoanInput,
  expectedScheduleLength: number,
  firstCashRowIndex = 0
) => {
  const result = calculateLoan(input);
  const regularResult = calculateLoan({
    ...input,
    firstInstallmentDate: addMonths(input.creditUsageDate, 1),
  });
  const firstCashRow = result.schedule[firstCashRowIndex];
  const regularFirstCashRow = regularResult.schedule[firstCashRowIndex];
  const lastRow = result.schedule[result.schedule.length - 1];

  expect(result.brokenPeriod.diffDays).toBeGreaterThan(0);
  expect(result.brokenPeriod.totalDiff).toBe(
    Number(
      (
        result.brokenPeriod.interestDiff +
        result.brokenPeriod.kkdfDiff +
        result.brokenPeriod.bsmvDiff
      ).toFixed(2)
    )
  );
  expect(result.schedule).toHaveLength(expectedScheduleLength);
  expect(firstCashRow.installmentNumber).not.toBe(0);
  expect(firstCashRow.interest).toBeGreaterThan(regularFirstCashRow.interest);
  expect(firstCashRow.installment).toBeGreaterThan(
    regularFirstCashRow.installment
  );
  expect(result.schedule.every((item) => item.installment > 0)).toBe(true);
  expect(result.schedule.every((item) => item.principal >= 0)).toBe(true);
  expect(result.schedule.every((item) => item.remainingPrincipal >= 0)).toBe(true);
  expect(result.totalPrincipal).toBe(input.principal);
  expect(lastRow.remainingPrincipal).toBe(0);
  expectScheduleDatesToFollowFirstInstallment(result);
  expectResultTotalsToMatchSchedule(result);
};

const expectInterestOnlyInvariants = (
  result: ReturnType<typeof calculateLoan>,
  principal: number,
  term: number,
  interestOnlyInstallmentCount: number
) => {
  const lastRow = result.schedule[result.schedule.length - 1];

  expect(result.planType).toBe('interestOnly');
  expect(result.schedule).toHaveLength(term);
  expect(result.schedule.some((item) => item.installmentNumber === 0)).toBe(false);
  expect(
    result.schedule
      .slice(0, interestOnlyInstallmentCount)
      .every((item) => item.isInterestOnly === true && item.principal === 0)
  ).toBe(true);
  expect(
    result.schedule
      .slice(interestOnlyInstallmentCount)
      .every((item) => item.isInterestOnly === false && item.principal > 0)
  ).toBe(true);
  expect(lastRow.remainingPrincipal).toBe(0);
  expect(result.totalPrincipal).toBe(principal);
  expectResultTotalsToMatchSchedule(result);
};

const expectIncreasingInstallmentInvariants = (
  result: ReturnType<typeof calculateLoan>,
  principal: number,
  term: number
) => {
  const lastRow = result.schedule[result.schedule.length - 1];

  expect(result.planType).toBe('increasingInstallment');
  expect(result.schedule).toHaveLength(term);
  expect(result.schedule.some((item) => item.installmentNumber === 0)).toBe(false);
  expect(result.schedule.every((item) => item.principal > 0)).toBe(true);
  expect(result.schedule.every((item) => item.remainingPrincipal >= 0)).toBe(true);
  expect(lastRow.remainingPrincipal).toBe(0);
  expect(result.totalPrincipal).toBe(principal);
  expectResultTotalsToMatchSchedule(result);
};

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

  it('rejects invalid dates', () => {
    expect(() =>
      calculateLoan({
        ...baseInput,
        creditUsageDate: new Date('invalid'),
      })
    ).toThrow('geçerli olmalıdır');
    expect(() =>
      calculateLoan({
        ...baseInput,
        firstInstallmentDate: new Date('invalid'),
      })
    ).toThrow('geçerli olmalıdır');
  });

  it.each([
    {
      name: 'standard',
      input: {
        principal: 250000,
        term: 12,
        monthlyInterestRatePercent: 4.3,
        kkdfRatePercent: 15,
        bsmvRatePercent: 15,
        creditUsageDate: new Date(2026, 5, 25),
        firstInstallmentDate: new Date(2026, 7, 1),
        planType: 'standard' as const,
      },
      expectedScheduleLength: 12,
    },
    {
      name: 'prepaid interest',
      input: {
        principal: 250000,
        term: 12,
        monthlyInterestRatePercent: 4.3,
        kkdfRatePercent: 15,
        bsmvRatePercent: 15,
        creditUsageDate: new Date(2026, 5, 25),
        firstInstallmentDate: new Date(2026, 7, 1),
        planType: 'prepaidInterest' as const,
        prepaidInterestAmount: 10000,
      },
      expectedScheduleLength: 13,
      firstCashRowIndex: 1,
    },
    {
      name: 'equal principal',
      input: {
        principal: 250000,
        term: 12,
        monthlyInterestRatePercent: 4.3,
        kkdfRatePercent: 15,
        bsmvRatePercent: 15,
        creditUsageDate: new Date(2026, 5, 25),
        firstInstallmentDate: new Date(2026, 7, 1),
        planType: 'equalPrincipal' as const,
      },
      expectedScheduleLength: 12,
    },
    {
      name: 'custom payment',
      input: {
        principal: 250000,
        term: 12,
        monthlyInterestRatePercent: 4.3,
        kkdfRatePercent: 15,
        bsmvRatePercent: 15,
        creditUsageDate: new Date(2026, 5, 25),
        firstInstallmentDate: new Date(2026, 7, 1),
        planType: 'customPayment' as const,
        customPayments: [{ installmentNo: 6, amount: 30000 }],
      },
      expectedScheduleLength: 12,
    },
    {
      name: 'interest-only',
      input: {
        principal: 250000,
        term: 12,
        monthlyInterestRatePercent: 4.3,
        kkdfRatePercent: 15,
        bsmvRatePercent: 15,
        creditUsageDate: new Date(2026, 5, 25),
        firstInstallmentDate: new Date(2026, 7, 1),
        planType: 'interestOnly' as const,
        interestOnlyInstallmentCount: 6,
      },
      expectedScheduleLength: 11,
    },
    {
      name: 'increasing installment',
      input: {
        principal: 250000,
        term: 12,
        monthlyInterestRatePercent: 4.3,
        kkdfRatePercent: 15,
        bsmvRatePercent: 15,
        creditUsageDate: new Date(2026, 5, 25),
        firstInstallmentDate: new Date(2026, 7, 1),
        planType: 'increasingInstallment' as const,
        installmentIncreaseRatePercent: 5,
        installmentIncreaseFrequencyMonths: 12,
      },
      expectedScheduleLength: 12,
    },
  ])(
    'keeps broken-period safety invariants for $name plan',
    ({ input, expectedScheduleLength, firstCashRowIndex }) => {
      expectBrokenPeriodSafetyInvariants(
        input,
        expectedScheduleLength,
        firstCashRowIndex
      );
    }
  );

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

  describe('equal principal plan', () => {
    const equalPrincipalInput = {
      creditUsageDate: new Date(2026, 5, 24),
      firstInstallmentDate: new Date(2026, 6, 24),
      planType: 'equalPrincipal' as const,
    };

    it('matches the tax-free simple case', () => {
      const result = calculateLoan({
        ...equalPrincipalInput,
        principal: 120000,
        term: 12,
        monthlyInterestRatePercent: 3,
        kkdfRatePercent: 0,
        bsmvRatePercent: 0,
      });

      expect(result.planType).toBe('equalPrincipal');
      expect(result.monthlyPrincipalAmount).toBe(10000);
      expect(result.schedule).toHaveLength(12);
      expect(result.schedule[0].interest).toBe(3600);
      expect(result.schedule[0].installment).toBe(13600);
      expect(result.schedule[1].interest).toBe(3300);
      expect(result.schedule[1].installment).toBe(13300);
      expect(result.schedule[11].interest).toBe(300);
      expect(result.schedule[11].installment).toBe(10300);
      expect(result.totalPrincipal).toBe(120000);
      expect(result.totalInterest).toBe(23400);
      expect(result.totalPayment).toBe(143400);
      expect(result.schedule[11].remainingPrincipal).toBe(0);
      expect(result.schedule.some((item) => item.installmentNumber === 0)).toBe(false);
      expectResultTotalsToMatchSchedule(result);
    });

    it('matches the taxed simple case', () => {
      const result = calculateLoan({
        ...equalPrincipalInput,
        principal: 120000,
        term: 12,
        monthlyInterestRatePercent: 3,
        kkdfRatePercent: 15,
        bsmvRatePercent: 15,
      });

      expect(result.monthlyPrincipalAmount).toBe(10000);
      expect(result.schedule[0].interest).toBe(3600);
      expect(result.schedule[0].kkdf).toBe(540);
      expect(result.schedule[0].bsmv).toBe(540);
      expect(result.schedule[0].installment).toBe(14680);
      expect(result.schedule[1].interest).toBe(3300);
      expect(result.schedule[1].kkdf).toBe(495);
      expect(result.schedule[1].bsmv).toBe(495);
      expect(result.schedule[1].installment).toBe(14290);
      expect(result.schedule[11].interest).toBe(300);
      expect(result.schedule[11].kkdf).toBe(45);
      expect(result.schedule[11].bsmv).toBe(45);
      expect(result.schedule[11].installment).toBe(10390);
      expect(result.totalPrincipal).toBe(120000);
      expect(result.totalInterest).toBe(23400);
      expect(result.totalKkdf).toBe(3510);
      expect(result.totalBsmv).toBe(3510);
      expect(result.totalPayment).toBe(150420);
      expect(result.schedule[11].remainingPrincipal).toBe(0);
      expectResultTotalsToMatchSchedule(result);
    });

    it('matches the large long-term tax-free case approximately', () => {
      const result = calculateLoan({
        ...equalPrincipalInput,
        principal: 1000000,
        term: 36,
        monthlyInterestRatePercent: 3.1,
        kkdfRatePercent: 0,
        bsmvRatePercent: 0,
      });

      expect(result.monthlyPrincipalAmount).toBe(27777.78);
      expect(result.schedule[0].interest).toBe(31000);
      expect(result.schedule[0].installment).toBe(58777.78);
      expect(result.schedule[1].interest).toBe(30138.89);
      expect(result.schedule[1].installment).toBe(57916.67);
      expect(result.schedule[35].interest).toBe(861.11);
      expect(result.schedule[35].installment).toBe(28638.81);
      expect(result.totalPrincipal).toBe(1000000);
      expectCloseWithin(result.totalInterest, 573499.96, 0.05);
      expectCloseWithin(result.totalPayment, 1573499.96, 0.05);
      expect(result.schedule[35].remainingPrincipal).toBe(0);
      expectResultTotalsToMatchSchedule(result);
    });

    it('matches the taxed medium-term case approximately', () => {
      const result = calculateLoan({
        ...equalPrincipalInput,
        principal: 500000,
        term: 24,
        monthlyInterestRatePercent: 4.2,
        kkdfRatePercent: 15,
        bsmvRatePercent: 15,
      });

      expect(result.monthlyPrincipalAmount).toBe(20833.33);
      expect(result.schedule[0].interest).toBe(21000);
      expect(result.schedule[0].kkdf).toBe(3150);
      expect(result.schedule[0].bsmv).toBe(3150);
      expect(result.schedule[0].installment).toBe(48133.33);
      expect(result.schedule[1].interest).toBe(20125);
      expect(result.schedule[1].installment).toBe(46995.83);
      expect(result.schedule[23].interest).toBe(875);
      expect(result.schedule[23].kkdf).toBe(131.25);
      expect(result.schedule[23].bsmv).toBe(131.25);
      expect(result.schedule[23].installment).toBe(21970.91);
      expect(result.totalPrincipal).toBe(500000);
      expect(result.totalInterest).toBe(262500);
      expect(result.totalKkdf).toBe(39375);
      expect(result.totalBsmv).toBe(39375);
      expect(result.totalPayment).toBe(841250);
      expect(result.schedule[23].remainingPrincipal).toBe(0);
      expectResultTotalsToMatchSchedule(result);
    });

    it('closes cent difference on the final principal payment', () => {
      const result = calculateLoan({
        ...equalPrincipalInput,
        principal: 100000,
        term: 3,
        monthlyInterestRatePercent: 2,
        kkdfRatePercent: 0,
        bsmvRatePercent: 0,
      });

      expect(result.schedule.map((item) => item.principal)).toEqual([
        33333.33,
        33333.33,
        33333.34,
      ]);
      expect(result.totalPrincipal).toBe(100000);
      expect(result.totalInterest).toBe(4000);
      expect(result.totalPayment).toBe(104000);
      expect(result.schedule[2].remainingPrincipal).toBe(0);
      expectResultTotalsToMatchSchedule(result);
    });

    it('keeps equal-principal installments decreasing', () => {
      const result = calculateLoan({
        ...equalPrincipalInput,
        principal: 120000,
        term: 12,
        monthlyInterestRatePercent: 3,
        kkdfRatePercent: 15,
        bsmvRatePercent: 15,
      });

      expect(
        result.schedule
          .slice(1)
          .every((item, index) => item.installment < result.schedule[index].installment)
      ).toBe(true);
    });

    it('applies broken period only to the first equal-principal installment', () => {
      const regularResult = calculateLoan({
        ...equalPrincipalInput,
        principal: 120000,
        term: 12,
        monthlyInterestRatePercent: 3,
        kkdfRatePercent: 15,
        bsmvRatePercent: 15,
      });
      const brokenResult = calculateLoan({
        ...equalPrincipalInput,
        principal: 120000,
        term: 12,
        monthlyInterestRatePercent: 3,
        kkdfRatePercent: 15,
        bsmvRatePercent: 15,
        firstInstallmentDate: new Date(2026, 7, 7),
      });

      expect(brokenResult.brokenPeriod.diffDays).toBeGreaterThan(0);
      expect(brokenResult.schedule[0].principal).toBe(10000);
      expect(brokenResult.schedule[0].interest).toBeGreaterThan(
        regularResult.schedule[0].interest
      );
      expect(brokenResult.schedule[1].interest).toBe(regularResult.schedule[1].interest);
      expect(brokenResult.schedule.map((item) => item.principal)).toEqual(
        regularResult.schedule.map((item) => item.principal)
      );
      expect(brokenResult.schedule[11].remainingPrincipal).toBe(0);
      expectResultTotalsToMatchSchedule(brokenResult);
    });
  });

  describe('custom payment plan', () => {
    const customPaymentBaseInput = {
      creditUsageDate: new Date(2026, 5, 24),
      firstInstallmentDate: new Date(2026, 6, 24),
      planType: 'customPayment' as const,
    };

    it('solves automatic installments after the first three low custom payments', () => {
      const result = calculateLoan({
        ...customPaymentBaseInput,
        principal: 120000,
        term: 12,
        monthlyInterestRatePercent: 3,
        kkdfRatePercent: 0,
        bsmvRatePercent: 0,
        customPayments: [
          { installmentNo: 1, amount: 8000 },
          { installmentNo: 2, amount: 8000 },
          { installmentNo: 3, amount: 8000 },
        ],
      });

      expect(result.planType).toBe('customPayment');
      expectCloseWithin(result.automaticInstallmentAmount ?? 0, 13665.37, 0.05);
      expect(result.schedule).toHaveLength(12);
      expect(result.schedule.some((item) => item.installmentNumber === 0)).toBe(false);
      expect(result.schedule[0].interest).toBe(3600);
      expect(result.schedule[0].principal).toBe(4400);
      expect(result.schedule[1].interest).toBe(3468);
      expect(result.schedule[1].principal).toBe(4532);
      expect(result.schedule[2].interest).toBe(3332.04);
      expect(result.schedule[2].principal).toBe(4667.96);
      expectCloseWithin(result.schedule[11].installment, 13665.35, 0.1);
      expectCloseWithin(result.totalInterest, 26988.31, 0.1);
      expectCloseWithin(result.totalPayment, 146988.31, 0.1);
      expect(result.schedule[11].remainingPrincipal).toBe(0);
      expect(result.discountedMonthlyRate).toBeUndefined();
      expect(result.monthlyPrincipalAmount).toBeUndefined();
      expectResultTotalsToMatchSchedule(result);
    });

    it('solves a final balloon payment plan', () => {
      const result = calculateLoan({
        ...customPaymentBaseInput,
        principal: 100000,
        term: 12,
        monthlyInterestRatePercent: 2,
        kkdfRatePercent: 0,
        bsmvRatePercent: 0,
        customPayments: [{ installmentNo: 12, amount: 50000 }],
      });

      expectCloseWithin(result.automaticInstallmentAmount ?? 0, 6189.47, 0.05);
      expect(result.schedule[0].interest).toBe(2000);
      expectCloseWithin(result.schedule[0].principal, 4189.47, 0.05);
      expectCloseWithin(result.schedule[11].interest, 980.39, 0.1);
      expectCloseWithin(result.schedule[11].principal, 49019.61, 0.1);
      expectCloseWithin(result.totalInterest, 18084.11, 0.1);
      expectCloseWithin(result.totalPayment, 118084.17, 0.1);
      expect(result.schedule[11].remainingPrincipal).toBe(0);
      expectResultTotalsToMatchSchedule(result);
    });

    it('solves taxed custom payments for the first six installments', () => {
      const result = calculateLoan({
        ...customPaymentBaseInput,
        principal: 500000,
        term: 24,
        monthlyInterestRatePercent: 4.2,
        kkdfRatePercent: 15,
        bsmvRatePercent: 15,
        customPayments: Array.from({ length: 6 }, (_, index) => ({
          installmentNo: index + 1,
          amount: 40000,
        })),
      });

      expectCloseWithin(result.automaticInstallmentAmount ?? 0, 36576.91, 0.1);
      expect(result.schedule[0].interest).toBe(21000);
      expect(result.schedule[0].kkdf).toBe(3150);
      expect(result.schedule[0].bsmv).toBe(3150);
      expect(result.schedule[0].principal).toBe(12700);
      expectCloseWithin(result.schedule[5].principal, 16566.96, 0.1);
      expectCloseWithin(result.schedule[6].installment, 36576.91, 0.1);
      expectCloseWithin(result.schedule[23].installment, 36576.71, 0.2);
      expectCloseWithin(result.totalInterest, 306449.38, 0.2);
      expectCloseWithin(result.totalKkdf, 45967.4, 0.2);
      expectCloseWithin(result.totalBsmv, 45967.4, 0.2);
      expectCloseWithin(result.totalPayment, 898384.18, 0.2);
      expect(result.schedule[23].remainingPrincipal).toBe(0);
      expectResultTotalsToMatchSchedule(result);
    });

    it('solves an interim balloon payment plan', () => {
      const result = calculateLoan({
        ...customPaymentBaseInput,
        principal: 300000,
        term: 12,
        monthlyInterestRatePercent: 3,
        kkdfRatePercent: 0,
        bsmvRatePercent: 0,
        customPayments: [{ installmentNo: 6, amount: 100000 }],
      });

      expectCloseWithin(result.automaticInstallmentAmount ?? 0, 23720.85, 0.05);
      expectCloseWithin(result.schedule[5].interest, 6655.35, 0.1);
      expectCloseWithin(result.schedule[5].principal, 93344.65, 0.1);
      expectCloseWithin(result.totalInterest, 60929.31, 0.1);
      expectCloseWithin(result.totalPayment, 360929.31, 0.1);
      expect(result.schedule[11].remainingPrincipal).toBe(0);
      expectResultTotalsToMatchSchedule(result);
    });

    it('accepts custom payments that exactly cover interest without principal', () => {
      const result = calculateLoan({
        ...customPaymentBaseInput,
        creditUsageDate: new Date(2026, 5, 23),
        firstInstallmentDate: new Date(2026, 6, 23),
        principal: 3000000,
        term: 60,
        monthlyInterestRatePercent: 3.1,
        kkdfRatePercent: 0,
        bsmvRatePercent: 0,
        customPayments: [
          { installmentNo: 1, amount: 93000 },
          { installmentNo: 2, amount: 93000 },
          { installmentNo: 3, amount: 93000 },
          { installmentNo: 4, amount: 93000 },
          { installmentNo: 5, amount: 93000 },
          { installmentNo: 6, amount: 1000000 },
        ],
      });

      result.schedule.slice(0, 5).forEach((item, index) => {
        expect(item.installmentNumber).toBe(index + 1);
        expect(item.principal).toBe(0);
        expect(item.interest).toBe(93000);
        expect(item.installment).toBe(93000);
        expect(item.remainingPrincipal).toBe(3000000);
      });
      expect(result.schedule[5].interest).toBe(93000);
      expect(result.schedule[5].principal).toBe(907000);
      expect(result.schedule[5].installment).toBe(1000000);
      expect(result.schedule[5].remainingPrincipal).toBe(2093000);
      expectCloseWithin(result.automaticInstallmentAmount ?? 0, 80332.89, 0.1);
      expectCloseWithin(result.schedule[6].installment, 80332.89, 0.1);
      expect(result.schedule[59].remainingPrincipal).toBe(0);
      expect(result.totalPrincipal).toBe(3000000);
      expectResultTotalsToMatchSchedule(result);
    });

    it('closes final cents after a first-installment custom payment', () => {
      const result = calculateLoan({
        ...customPaymentBaseInput,
        principal: 100000,
        term: 3,
        monthlyInterestRatePercent: 2,
        kkdfRatePercent: 0,
        bsmvRatePercent: 0,
        customPayments: [{ installmentNo: 1, amount: 40000 }],
      });

      expectCloseWithin(result.automaticInstallmentAmount ?? 0, 31933.07, 0.05);
      expect(result.schedule[0].interest).toBe(2000);
      expect(result.schedule[0].principal).toBe(38000);
      expect(result.schedule[1].interest).toBe(1240);
      expectCloseWithin(result.schedule[2].interest, 626.14, 0.05);
      expectCloseWithin(result.totalInterest, 3866.14, 0.05);
      expectCloseWithin(result.totalPayment, 103866.14, 0.05);
      expect(result.schedule[2].remainingPrincipal).toBe(0);
      expectResultTotalsToMatchSchedule(result);
    });

    it('applies broken period to the first custom-payment installment only', () => {
      const regularResult = calculateLoan({
        ...customPaymentBaseInput,
        principal: 120000,
        term: 12,
        monthlyInterestRatePercent: 3,
        kkdfRatePercent: 0,
        bsmvRatePercent: 0,
        customPayments: [{ installmentNo: 6, amount: 30000 }],
      });
      const brokenResult = calculateLoan({
        ...customPaymentBaseInput,
        principal: 120000,
        term: 12,
        monthlyInterestRatePercent: 3,
        kkdfRatePercent: 0,
        bsmvRatePercent: 0,
        firstInstallmentDate: new Date(2026, 7, 7),
        customPayments: [{ installmentNo: 6, amount: 30000 }],
      });

      expect(brokenResult.brokenPeriod.diffDays).toBeGreaterThan(0);
      expect(brokenResult.schedule[0].interest).toBeGreaterThan(
        regularResult.schedule[0].interest
      );
      expect(brokenResult.schedule[1].interest).toBeGreaterThan(
        regularResult.schedule[1].interest
      );
      expect(brokenResult.schedule[11].remainingPrincipal).toBe(0);
      expectResultTotalsToMatchSchedule(brokenResult);
    });

    it('rejects invalid custom payment inputs', () => {
      const commonInput = {
        ...customPaymentBaseInput,
        principal: 100000,
        term: 12,
        monthlyInterestRatePercent: 2,
        kkdfRatePercent: 0,
        bsmvRatePercent: 0,
      };

      expect(() => calculateLoan(commonInput)).toThrow('en az bir özel taksit');
      expect(() =>
        calculateLoan({
          ...commonInput,
          customPayments: [{ installmentNo: 0, amount: 10000 }],
        })
      ).toThrow('1 ile vade arasında');
      expect(() =>
        calculateLoan({
          ...commonInput,
          customPayments: [{ installmentNo: 13, amount: 10000 }],
        })
      ).toThrow('1 ile vade arasında');
      expect(() =>
        calculateLoan({
          ...commonInput,
          customPayments: [
            { installmentNo: 1, amount: 10000 },
            { installmentNo: 1, amount: 12000 },
          ],
        })
      ).toThrow('birden fazla');
      expect(() =>
        calculateLoan({
          ...commonInput,
          customPayments: [{ installmentNo: 1, amount: -10000 }],
        })
      ).toThrow('pozitif');
      expect(() =>
        calculateLoan({
          ...commonInput,
          customPayments: [{ installmentNo: 1, amount: 0 }],
        })
      ).toThrow('pozitif');
      expect(() =>
        calculateLoan({
          ...customPaymentBaseInput,
          creditUsageDate: new Date(2026, 5, 23),
          firstInstallmentDate: new Date(2026, 6, 23),
          principal: 3000000,
          term: 60,
          monthlyInterestRatePercent: 3.1,
          kkdfRatePercent: 0,
          bsmvRatePercent: 0,
          customPayments: [
            { installmentNo: 1, amount: 92999.99 },
            { installmentNo: 2, amount: 93000 },
            { installmentNo: 3, amount: 93000 },
            { installmentNo: 4, amount: 93000 },
            { installmentNo: 5, amount: 93000 },
            { installmentNo: 6, amount: 1000000 },
          ],
        })
      ).toThrow('faiz ve vergi');
      expect(() =>
        calculateLoan({
          ...customPaymentBaseInput,
          principal: 500000,
          term: 24,
          monthlyInterestRatePercent: 4.2,
          kkdfRatePercent: 15,
          bsmvRatePercent: 15,
          customPayments: [{ installmentNo: 1, amount: 20000 }],
        })
      ).toThrow('faiz ve vergi');
      expect(() =>
        calculateLoan({
          ...commonInput,
          customPayments: [{ installmentNo: 1, amount: 200000 }],
        })
      ).toThrow('negatife');
      expect(() =>
        calculateLoan({
          ...commonInput,
          term: 2,
          monthlyInterestRatePercent: 0,
          customPayments: [
            { installmentNo: 1, amount: 40000 },
            { installmentNo: 2, amount: 40000 },
          ],
        })
      ).toThrow('vade sonunda');
    });
  });

  describe('interest-only first period plan', () => {
    const interestOnlyBaseInput = {
      creditUsageDate: new Date(2026, 5, 24),
      firstInstallmentDate: new Date(2026, 6, 24),
      planType: 'interestOnly' as const,
    };

    it('creates a tax-free interest-only period before the amortizing period', () => {
      const result = calculateLoan({
        ...interestOnlyBaseInput,
        principal: 120000,
        term: 12,
        monthlyInterestRatePercent: 3,
        kkdfRatePercent: 0,
        bsmvRatePercent: 0,
        interestOnlyInstallmentCount: 3,
      });

      expectInterestOnlyInvariants(result, 120000, 12, 3);
      expect(result.interestOnlyInstallmentCount).toBe(3);
      expect(result.postInterestOnlyInstallmentAmount).toBe(15412.06);
      result.schedule.slice(0, 3).forEach((item) => {
        expect(item.interest).toBe(3600);
        expect(item.kkdf).toBe(0);
        expect(item.bsmv).toBe(0);
        expect(item.installment).toBe(3600);
        expect(item.remainingPrincipal).toBe(120000);
      });
      expect(result.schedule[3].installment).toBe(15412.06);
      expect(result.schedule[3].principal).toBe(11812.06);
      expectCloseWithin(result.totalInterest, 29508.58, 0.05);
      expectCloseWithin(result.totalPayment, 149508.58, 0.05);
    });

    it('calculates taxes during the interest-only and amortizing periods', () => {
      const result = calculateLoan({
        ...interestOnlyBaseInput,
        principal: 120000,
        term: 12,
        monthlyInterestRatePercent: 3,
        kkdfRatePercent: 15,
        bsmvRatePercent: 15,
        interestOnlyInstallmentCount: 3,
      });

      expectInterestOnlyInvariants(result, 120000, 12, 3);
      expect(result.postInterestOnlyInstallmentAmount).toBe(16065.7);
      result.schedule.slice(0, 3).forEach((item) => {
        expect(item.interest).toBe(3600);
        expect(item.kkdf).toBe(540);
        expect(item.bsmv).toBe(540);
        expect(item.installment).toBe(4680);
        expect(item.remainingPrincipal).toBe(120000);
      });
      expect(result.schedule[3].installment).toBe(16065.7);
      expect(result.schedule[3].principal).toBe(11385.7);
      expectCloseWithin(result.totalInterest, 29716.37, 0.05);
      expectCloseWithin(result.totalKkdf, 4457.44, 0.05);
      expectCloseWithin(result.totalBsmv, 4457.44, 0.05);
      expectCloseWithin(result.totalPayment, 158631.25, 0.05);
    });

    it('handles a large long-term tax-free interest-only period', () => {
      const result = calculateLoan({
        ...interestOnlyBaseInput,
        principal: 1000000,
        term: 36,
        monthlyInterestRatePercent: 3.1,
        kkdfRatePercent: 0,
        bsmvRatePercent: 0,
        interestOnlyInstallmentCount: 6,
      });

      expectInterestOnlyInvariants(result, 1000000, 36, 6);
      expect(result.postInterestOnlyInstallmentAmount).toBe(51680.95);
      result.schedule.slice(0, 6).forEach((item) => {
        expect(item.interest).toBe(31000);
        expect(item.principal).toBe(0);
        expect(item.installment).toBe(31000);
        expect(item.remainingPrincipal).toBe(1000000);
      });
      expect(result.schedule[6].installment).toBe(51680.95);
      expect(result.schedule[6].principal).toBe(20680.95);
      expectCloseWithin(result.totalInterest, 736428.66, 0.1);
      expectCloseWithin(result.totalPayment, 1736428.66, 0.1);
    });

    it('applies broken period interest only to the first interest-only installment', () => {
      const regularResult = calculateLoan({
        ...interestOnlyBaseInput,
        principal: 1000000,
        term: 36,
        monthlyInterestRatePercent: 3.1,
        kkdfRatePercent: 0,
        bsmvRatePercent: 0,
        interestOnlyInstallmentCount: 3,
      });
      const brokenResult = calculateLoan({
        ...interestOnlyBaseInput,
        principal: 1000000,
        term: 36,
        monthlyInterestRatePercent: 3.1,
        kkdfRatePercent: 0,
        bsmvRatePercent: 0,
        firstInstallmentDate: new Date(2026, 7, 24),
        interestOnlyInstallmentCount: 3,
      });

      expectInterestOnlyInvariants(brokenResult, 1000000, 35, 3);
      expect(brokenResult.brokenPeriod.diffDays).toBe(31);
      expect(brokenResult.schedule[0].isInterestOnly).toBe(true);
      expect(brokenResult.schedule[0].principal).toBe(0);
      expect(brokenResult.schedule[0].interest).toBe(
        regularResult.schedule[0].interest + brokenResult.brokenPeriod.interestDiff
      );
      expect(brokenResult.schedule[1].interest).toBe(regularResult.schedule[1].interest);
      expect(brokenResult.schedule[2].interest).toBe(regularResult.schedule[2].interest);
      expect(brokenResult.schedule[3].principal).toBeGreaterThan(0);
      expect(brokenResult.schedule[3].isInterestOnly).toBe(false);
    });

    it('limits interest-only schedule dates to the total maturity end date', () => {
      const result = calculateLoan({
        principal: 250000,
        term: 12,
        monthlyInterestRatePercent: 4.3,
        kkdfRatePercent: 15,
        bsmvRatePercent: 15,
        creditUsageDate: new Date(2026, 5, 25),
        firstInstallmentDate: new Date(2026, 7, 1),
        planType: 'interestOnly',
        interestOnlyInstallmentCount: 6,
      });
      const firstRow = result.schedule[0];
      const secondRow = result.schedule[1];
      const finalRow = result.schedule[result.schedule.length - 1];
      const amortizingInstallments = result.schedule.slice(6);

      expectInterestOnlyInvariants(result, 250000, 11, 6);
      expect(result.schedule.some((item) => item.installmentNumber === 0)).toBe(
        false
      );
      expect(firstRow.date).toEqual(new Date(2026, 7, 1));
      expect(finalRow.date).toEqual(new Date(2027, 5, 1));
      expect(result.schedule).toHaveLength(11);
      expect(result.schedule.slice(0, 6).every((item) => item.principal === 0)).toBe(
        true
      );
      expect(
        result.schedule
          .slice(0, 6)
          .every((item) => item.remainingPrincipal === 250000)
      ).toBe(true);
      expect(amortizingInstallments.every((item) => item.principal > 0)).toBe(
        true
      );
      expect(firstRow.interest).toBeCloseTo(13258.33, 2);
      expect(firstRow.kkdf).toBeCloseTo(1988.75, 2);
      expect(firstRow.bsmv).toBeCloseTo(1988.75, 2);
      expect(firstRow.installment).toBeCloseTo(17235.83, 2);
      expect(secondRow.interest).toBeCloseTo(10750, 2);
      expect(secondRow.kkdf).toBeCloseTo(1612.5, 2);
      expect(secondRow.bsmv).toBeCloseTo(1612.5, 2);
      expect(secondRow.installment).toBeCloseTo(13975, 2);
      amortizingInstallments.forEach((item) => {
        expect(item.installment).toBeCloseTo(58688.67, 1);
      });
      expect(result.totalPrincipal).toBeCloseTo(250000, 2);
      expect(result.totalInterest).toBeCloseTo(100426.29, 1);
      expect(result.totalKkdf).toBeCloseTo(15063.94, 1);
      expect(result.totalBsmv).toBeCloseTo(15063.94, 1);
      expect(result.totalPayment).toBeCloseTo(380554.17, 1);
      expect(finalRow.remainingPrincipal).toBe(0);
    });

    it('validates interest-only count against the effective installment count', () => {
      const commonInput = {
        principal: 250000,
        term: 12,
        monthlyInterestRatePercent: 4.3,
        kkdfRatePercent: 15,
        bsmvRatePercent: 15,
        creditUsageDate: new Date(2026, 5, 25),
        firstInstallmentDate: new Date(2026, 7, 1),
        planType: 'interestOnly' as const,
      };

      expect(() =>
        calculateLoan({ ...commonInput, interestOnlyInstallmentCount: 6 })
      ).not.toThrow();
      expect(() =>
        calculateLoan({ ...commonInput, interestOnlyInstallmentCount: 11 })
      ).toThrow('efektif taksit sayısından küçük');
      expect(() =>
        calculateLoan({ ...commonInput, interestOnlyInstallmentCount: 12 })
      ).toThrow('efektif taksit sayısından küçük');
    });

    it('keeps standard plan installment count unchanged when first date is delayed', () => {
      const result = calculateLoan({
        principal: 250000,
        term: 12,
        monthlyInterestRatePercent: 4.3,
        kkdfRatePercent: 15,
        bsmvRatePercent: 15,
        creditUsageDate: new Date(2026, 5, 25),
        firstInstallmentDate: new Date(2026, 7, 1),
        planType: 'standard',
      });

      expect(result.planType).toBe('standard');
      expect(result.schedule).toHaveLength(12);
      expect(result.schedule[11].installmentNumber).toBe(12);
      expect(result.schedule[11].date).toEqual(new Date(2027, 6, 1));
      expect(result.schedule[11].remainingPrincipal).toBe(0);
    });

    it('allows interest-only installments until the month before final amortization', () => {
      const result = calculateLoan({
        ...interestOnlyBaseInput,
        principal: 100000,
        term: 12,
        monthlyInterestRatePercent: 2,
        kkdfRatePercent: 0,
        bsmvRatePercent: 0,
        interestOnlyInstallmentCount: 11,
      });
      const finalRow = result.schedule[11];

      expectInterestOnlyInvariants(result, 100000, 12, 11);
      expect(result.postInterestOnlyInstallmentAmount).toBe(102000);
      result.schedule.slice(0, 11).forEach((item) => {
        expect(item.principal).toBe(0);
        expect(item.interest).toBe(2000);
        expect(item.installment).toBe(2000);
      });
      expect(finalRow.interest).toBe(2000);
      expect(finalRow.principal).toBe(100000);
      expect(finalRow.installment).toBe(102000);
      expect(result.totalInterest).toBe(24000);
      expect(result.totalPayment).toBe(124000);
    });

    it('rejects invalid interest-only installment counts', () => {
      const commonInput = {
        ...interestOnlyBaseInput,
        principal: 100000,
        term: 12,
        monthlyInterestRatePercent: 2,
        kkdfRatePercent: 0,
        bsmvRatePercent: 0,
      };

      expect(() => calculateLoan(commonInput)).toThrow('taksit sayısı girilmelidir');
      expect(() =>
        calculateLoan({ ...commonInput, interestOnlyInstallmentCount: 0 })
      ).toThrow('pozitif');
      expect(() =>
        calculateLoan({ ...commonInput, interestOnlyInstallmentCount: -1 })
      ).toThrow('pozitif');
      expect(() =>
        calculateLoan({ ...commonInput, interestOnlyInstallmentCount: 12 })
      ).toThrow('efektif taksit sayısından küçük');
      expect(() =>
        calculateLoan({ ...commonInput, interestOnlyInstallmentCount: 13 })
      ).toThrow('efektif taksit sayısından küçük');
      expect(() =>
        calculateLoan({ ...commonInput, interestOnlyInstallmentCount: 2.5 })
      ).toThrow('tam sayı');
    });
  });

  describe('increasing installment plan', () => {
    const increasingBaseInput = {
      creditUsageDate: new Date(2026, 5, 24),
      firstInstallmentDate: new Date(2026, 6, 24),
      planType: 'increasingInstallment' as const,
    };

    const cases = [
      {
        name: 'simple tax-free case',
        input: {
          principal: 100000,
          term: 12,
          monthlyInterestRatePercent: 2,
          kkdfRatePercent: 0,
          bsmvRatePercent: 0,
          installmentIncreaseRatePercent: 5,
          installmentIncreaseFrequencyMonths: 1,
        },
        expected: {
          firstInstallment: 7211.19,
          secondInstallment: 7571.75,
          lastInstallment: 12333.49,
          totalInterest: 14781.33,
          totalKkdf: 0,
          totalBsmv: 0,
          totalPayment: 114781.33,
        },
      },
      {
        name: 'five percent tax-free case',
        input: {
          principal: 120000,
          term: 12,
          monthlyInterestRatePercent: 3,
          kkdfRatePercent: 0,
          bsmvRatePercent: 0,
          installmentIncreaseRatePercent: 5,
          installmentIncreaseFrequencyMonths: 1,
        },
        expected: {
          firstInstallment: 9245.8,
          secondInstallment: 9708.09,
          lastInstallment: 15813.35,
          totalInterest: 27166.46,
          totalKkdf: 0,
          totalBsmv: 0,
          totalPayment: 147166.46,
        },
      },
      {
        name: 'taxed increasing installment case',
        input: {
          principal: 120000,
          term: 12,
          monthlyInterestRatePercent: 3,
          kkdfRatePercent: 15,
          bsmvRatePercent: 15,
          installmentIncreaseRatePercent: 5,
          installmentIncreaseFrequencyMonths: 1,
        },
        expected: {
          firstInstallment: 9798.8,
          secondInstallment: 10288.74,
          lastInstallment: 16759.34,
          totalInterest: 27668.31,
          totalKkdf: 4150.25,
          totalBsmv: 4150.25,
          totalPayment: 155968.81,
        },
      },
      {
        name: 'large long-term case',
        input: {
          principal: 1000000,
          term: 36,
          monthlyInterestRatePercent: 3.1,
          kkdfRatePercent: 0,
          bsmvRatePercent: 0,
          installmentIncreaseRatePercent: 2,
          installmentIncreaseFrequencyMonths: 1,
        },
        expected: {
          firstInstallment: 34338.94,
          secondInstallment: 35025.72,
          lastInstallment: 68673.95,
          totalInterest: 785431.32,
          totalKkdf: 0,
          totalBsmv: 0,
          totalPayment: 1785431.32,
        },
      },
      {
        name: 'taxed high-rate medium-term case',
        input: {
          principal: 500000,
          term: 24,
          monthlyInterestRatePercent: 4.2,
          kkdfRatePercent: 15,
          bsmvRatePercent: 15,
          installmentIncreaseRatePercent: 3,
          installmentIncreaseFrequencyMonths: 1,
        },
        expected: {
          firstInstallment: 28441.12,
          secondInstallment: 29294.35,
          lastInstallment: 56131.1,
          totalInterest: 368559.58,
          totalKkdf: 55283.94,
          totalBsmv: 55283.94,
          totalPayment: 979127.46,
        },
      },
    ];

    it.each(cases)('$name', ({ input, expected }) => {
      const result = calculateLoan({
        ...increasingBaseInput,
        ...input,
      });
      const lastRow = result.schedule[result.schedule.length - 1];

      expectIncreasingInstallmentInvariants(result, input.principal, input.term);
      expect(result.installmentIncreaseRatePercent).toBe(
        input.installmentIncreaseRatePercent
      );
      expect(result.baseInstallmentAmount).toBe(expected.firstInstallment);
      expect(result.firstInstallmentAmount).toBe(expected.firstInstallment);
      expect(result.schedule[0].installment).toBe(expected.firstInstallment);
      expect(result.schedule[1].installment).toBe(expected.secondInstallment);
      expect(lastRow.installment).toBe(expected.lastInstallment);
      expectCloseWithin(result.totalInterest, expected.totalInterest, 0.05);
      expectCloseWithin(result.totalKkdf, expected.totalKkdf, 0.05);
      expectCloseWithin(result.totalBsmv, expected.totalBsmv, 0.05);
      expectCloseWithin(result.totalPayment, expected.totalPayment, 0.05);
    });

    it('closes final cents on the last installment', () => {
      const result = calculateLoan({
        ...increasingBaseInput,
        principal: 100000,
        term: 3,
        monthlyInterestRatePercent: 2,
        kkdfRatePercent: 0,
        bsmvRatePercent: 0,
        installmentIncreaseRatePercent: 10,
        installmentIncreaseFrequencyMonths: 1,
      });

      expectIncreasingInstallmentInvariants(result, 100000, 3);
      expect(result.schedule[0].installment).toBe(31467.44);
      expect(result.schedule[1].installment).toBe(34614.18);
      expect(result.schedule[2].installment).toBe(38075.61);
      expect(result.totalInterest).toBe(4157.23);
      expect(result.totalPayment).toBe(104157.23);
    });

    it('matches the İş Bankası style periodic increase reference case', () => {
      const result = calculateLoan({
        ...increasingBaseInput,
        principal: 1000000,
        term: 60,
        monthlyInterestRatePercent: 3.1,
        kkdfRatePercent: 0,
        bsmvRatePercent: 0,
        installmentIncreaseRatePercent: 5,
        installmentIncreaseFrequencyMonths: 12,
      });
      const lastRow = result.schedule[result.schedule.length - 1];

      expectIncreasingInstallmentInvariants(result, 1000000, 60);
      expect(result.installmentIncreaseFrequencyMonths).toBe(12);
      expect(result.schedule.slice(0, 12).every((item) => item.installment === 34560.06)).toBe(true);
      expect(result.schedule.slice(12, 24).every((item) => item.installment === 36288.06)).toBe(true);
      expect(result.schedule.slice(24, 36).every((item) => item.installment === 38102.47)).toBe(true);
      expect(result.schedule.slice(36, 48).every((item) => item.installment === 40007.59)).toBe(true);
      expect(result.schedule.slice(48, 59).every((item) => item.installment === 42007.97)).toBe(true);
      expect(lastRow.installment).toBe(42007.25);
      expect(result.totalPrincipal).toBeCloseTo(1000000, 2);
      expectCloseWithin(result.totalInterest, 1291593.44, 1);
      expectCloseWithin(result.totalPayment, 2291593.44, 1);
      expect(lastRow.remainingPrincipal).toBe(0);
    });

    it('calculates long-term periodic ten percent increases', () => {
      const result = calculateLoan({
        ...increasingBaseInput,
        principal: 1000000,
        term: 60,
        monthlyInterestRatePercent: 3.1,
        kkdfRatePercent: 0,
        bsmvRatePercent: 0,
        installmentIncreaseRatePercent: 10,
        installmentIncreaseFrequencyMonths: 12,
      });

      expectIncreasingInstallmentInvariants(result, 1000000, 60);
      expect(result.schedule[0].installment).toBe(32332);
      expect(result.schedule[12].installment).toBe(35565.2);
      expect(result.schedule[24].installment).toBe(39121.72);
      expect(result.schedule[36].installment).toBe(43033.89);
      expect(result.schedule[48].installment).toBe(47337.28);
      expect(result.totalPayment).toBeCloseTo(2368681.19, 0.05);
    });

    it('applies broken period only to the first increasing installment', () => {
      const regularResult = calculateLoan({
        ...increasingBaseInput,
        principal: 120000,
        term: 12,
        monthlyInterestRatePercent: 3,
        kkdfRatePercent: 0,
        bsmvRatePercent: 0,
        installmentIncreaseRatePercent: 5,
        installmentIncreaseFrequencyMonths: 1,
      });
      const brokenResult = calculateLoan({
        ...increasingBaseInput,
        principal: 120000,
        term: 12,
        monthlyInterestRatePercent: 3,
        kkdfRatePercent: 0,
        bsmvRatePercent: 0,
        firstInstallmentDate: new Date(2026, 7, 24),
        installmentIncreaseRatePercent: 5,
        installmentIncreaseFrequencyMonths: 1,
      });

      expectIncreasingInstallmentInvariants(brokenResult, 120000, 12);
      expect(brokenResult.brokenPeriod.diffDays).toBe(31);
      expect(brokenResult.schedule[0].interest).toBeGreaterThan(
        regularResult.schedule[0].interest
      );
      expect(brokenResult.schedule[1].installment).toBeCloseTo(
        brokenResult.schedule[0].installment * 1.05,
        0
      );
      expect(brokenResult.schedule[1].interest).toBe(
        Number((brokenResult.schedule[0].remainingPrincipal * 0.03).toFixed(2))
      );
    });

    it('rejects invalid increasing installment inputs', () => {
      const commonInput = {
        ...increasingBaseInput,
        principal: 100000,
        term: 12,
        monthlyInterestRatePercent: 3,
        kkdfRatePercent: 0,
        bsmvRatePercent: 0,
      };

      expect(() => calculateLoan(commonInput)).toThrow('artış oranı girilmelidir');
      expect(() =>
        calculateLoan({ ...commonInput, installmentIncreaseRatePercent: 0 })
      ).toThrow('pozitif');
      expect(() =>
        calculateLoan({ ...commonInput, installmentIncreaseRatePercent: -1 })
      ).toThrow('pozitif');
      expect(() =>
        calculateLoan({
          ...commonInput,
          installmentIncreaseRatePercent: 50,
          installmentIncreaseFrequencyMonths: 1,
        })
      ).toThrow();
      expect(() =>
        calculateLoan({
          ...commonInput,
          term: 1,
          installmentIncreaseRatePercent: 5,
          installmentIncreaseFrequencyMonths: 1,
        })
      ).toThrow('vade 1 aydan büyük');
      expect(() =>
        calculateLoan({
          ...commonInput,
          installmentIncreaseRatePercent: 5,
        })
      ).toThrow('artış sıklığı girilmelidir');
      expect(() =>
        calculateLoan({
          ...commonInput,
          installmentIncreaseRatePercent: 5,
          installmentIncreaseFrequencyMonths: 0,
        })
      ).toThrow('Artış sıklığı pozitif');
      expect(() =>
        calculateLoan({
          ...commonInput,
          installmentIncreaseRatePercent: 5,
          installmentIncreaseFrequencyMonths: -1,
        })
      ).toThrow('Artış sıklığı pozitif');
      expect(() =>
        calculateLoan({
          ...commonInput,
          installmentIncreaseRatePercent: 5,
          installmentIncreaseFrequencyMonths: 2.5,
        })
      ).toThrow('Artış sıklığı tam sayı');
      expect(() =>
        calculateLoan({
          ...commonInput,
          installmentIncreaseRatePercent: 5,
          installmentIncreaseFrequencyMonths: 13,
        })
      ).toThrow('Artış sıklığı vadeden büyük');
    });

    it('calculates long-term high increase rates when a yearly frequency is provided', () => {
      const commonInput = {
        ...increasingBaseInput,
        principal: 1000000,
        term: 60,
        monthlyInterestRatePercent: 3.1,
        kkdfRatePercent: 0,
        bsmvRatePercent: 0,
      };

      const fivePercentResult = calculateLoan({
        ...commonInput,
        installmentIncreaseRatePercent: 5,
        installmentIncreaseFrequencyMonths: 12,
      });
      const tenPercentResult = calculateLoan({
        ...commonInput,
        installmentIncreaseRatePercent: 10,
        installmentIncreaseFrequencyMonths: 12,
      });

      expectIncreasingInstallmentInvariants(fivePercentResult, 1000000, 60);
      expectIncreasingInstallmentInvariants(tenPercentResult, 1000000, 60);
      expect(fivePercentResult.totalPayment).toBeCloseTo(2291593.08, 0.05);
      expect(tenPercentResult.totalPayment).toBeCloseTo(2368681.19, 0.05);
    });
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
