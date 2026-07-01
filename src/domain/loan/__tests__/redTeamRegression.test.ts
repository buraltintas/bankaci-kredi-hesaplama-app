import { calculateLoan as calculateLoanEngine } from '../calculateLoan';
import type { LoanCalculationResult, LoanInput } from '../types';
import { buildCustomPaymentsFromRows } from '../customPaymentForm';

const calculateLoan = (input: LoanInput) =>
  calculateLoanEngine({
    deductFirstInstallmentDelayFromTerm: false,
    ...input,
  });

const round2 = (value: number) => Number(value.toFixed(2));
const tolerance = 0.05;

const sumSchedule = (
  result: LoanCalculationResult,
  key: 'installment' | 'principal' | 'interest' | 'kkdf' | 'bsmv'
) => round2(result.schedule.reduce((total, item) => total + item[key], 0));

const expectFiniteMoney = (value: number) => {
  expect(Number.isFinite(value)).toBe(true);
  expect(Object.is(value, -0)).toBe(false);
};

const expectValidResult = (
  result: LoanCalculationResult,
  expectedPrincipal: number,
  expectedMaxScheduleLength = result.input.term + 1
) => {
  expect(result.schedule.length).toBeGreaterThan(0);
  expect(result.schedule.length).toBeLessThanOrEqual(expectedMaxScheduleLength);

  [
    result.firstInstallment,
    result.standardInstallment,
    result.totalPayment,
    result.totalPrincipal,
    result.totalInterest,
    result.totalKkdf,
    result.totalBsmv,
    result.realizedPrepaidInterest ?? 0,
    result.discountedMonthlyRate ?? 0,
    result.monthlyPrincipalAmount ?? 0,
    result.automaticInstallmentAmount ?? 0,
    result.postInterestOnlyInstallmentAmount ?? 0,
    result.installmentIncreaseRatePercent ?? 0,
    result.installmentIncreaseFrequencyMonths ?? 0,
    result.baseInstallmentAmount ?? 0,
    result.firstInstallmentAmount ?? 0,
    result.lastInstallmentAmount ?? 0,
  ].forEach(expectFiniteMoney);

  result.schedule.forEach((item) => {
    [
      item.installment,
      item.principal,
      item.interest,
      item.kkdf,
      item.bsmv,
      item.remainingPrincipal,
    ].forEach(expectFiniteMoney);
    expect(item.installment).toBeGreaterThanOrEqual(0);
    expect(item.principal).toBeGreaterThanOrEqual(0);
    expect(item.interest).toBeGreaterThanOrEqual(0);
    expect(item.kkdf).toBeGreaterThanOrEqual(0);
    expect(item.bsmv).toBeGreaterThanOrEqual(0);
    expect(item.remainingPrincipal).toBeGreaterThanOrEqual(-tolerance);
  });

  expect(Math.abs(result.totalPayment - sumSchedule(result, 'installment'))).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(result.totalPrincipal - sumSchedule(result, 'principal'))).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(result.totalInterest - sumSchedule(result, 'interest'))).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(result.totalKkdf - sumSchedule(result, 'kkdf'))).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(result.totalBsmv - sumSchedule(result, 'bsmv'))).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(result.totalPrincipal - expectedPrincipal)).toBeLessThanOrEqual(tolerance);
  expect(
    Math.abs(result.schedule[result.schedule.length - 1].remainingPrincipal)
  ).toBeLessThanOrEqual(tolerance);
};

const baseInput = {
  creditUsageDate: new Date(2026, 0, 31),
  firstInstallmentDate: new Date(2026, 1, 28),
  kkdfRatePercent: 0,
  bsmvRatePercent: 0,
};

describe('final red-team regression', () => {
  it('keeps global invariants across a deterministic standard/equal-principal matrix', () => {
    const principals = [1, 100, 999.99, 100000, 99999999.99];
    const terms = [1, 2, 12, 60, 240];
    const rates = [0, 0.01, 3.1, 25];
    const taxes = [
      [0, 0],
      [15, 15],
      [0, 15],
      [30, 30],
    ];

    principals.forEach((principal) => {
      terms.forEach((term) => {
        rates.forEach((monthlyInterestRatePercent) => {
          taxes.forEach(([kkdfRatePercent, bsmvRatePercent]) => {
            (['standard', 'equalPrincipal'] as const).forEach((planType) => {
              const result = calculateLoan({
                ...baseInput,
                principal,
                term,
                monthlyInterestRatePercent,
                kkdfRatePercent,
                bsmvRatePercent,
                planType,
              });

              expectValidResult(result, principal, term);
            });
          });
        });
      });
    });
  });

  it('rejects invalid date inputs and accepts valid broken-period date edges', () => {
    expect(() =>
      calculateLoan({
        ...baseInput,
        principal: 100000,
        term: 12,
        monthlyInterestRatePercent: 3,
        creditUsageDate: new Date(Number.NaN),
        firstInstallmentDate: new Date(2026, 1, 28),
      })
    ).toThrow('geçerli');
    expect(() =>
      calculateLoan({
        ...baseInput,
        principal: 100000,
        term: 12,
        monthlyInterestRatePercent: 3,
        creditUsageDate: new Date(2026, 1, 1),
        firstInstallmentDate: new Date(2026, 0, 31),
      })
    ).toThrow('önce');

    [
      [new Date(2026, 0, 31), new Date(2026, 1, 28)],
      [new Date(2028, 0, 31), new Date(2028, 1, 29)],
      [new Date(2026, 11, 31), new Date(2027, 0, 31)],
      [new Date(2026, 5, 24), new Date(2026, 5, 24)],
      [new Date(2026, 5, 24), new Date(2026, 5, 25)],
      [new Date(2026, 5, 24), new Date(2026, 6, 31)],
      [new Date(2026, 5, 24), new Date(2026, 7, 23)],
    ].forEach(([creditUsageDate, firstInstallmentDate]) => {
      const result = calculateLoan({
        principal: 100000,
        term: 12,
        monthlyInterestRatePercent: 3,
        kkdfRatePercent: 15,
        bsmvRatePercent: 15,
        creditUsageDate,
        firstInstallmentDate,
      });

      expectValidResult(result, 100000, 12);
    });
  });

  it('red-teams prepaid interest validation and invariants', () => {
    const input = {
      ...baseInput,
      principal: 1000000,
      term: 36,
      monthlyInterestRatePercent: 3.1,
      kkdfRatePercent: 15,
      bsmvRatePercent: 15,
      planType: 'prepaidInterest' as const,
    };

    expect(() => calculateLoan({ ...input, prepaidInterestAmount: 0 })).toThrow(
      'pozitif'
    );
    expect(() => calculateLoan({ ...input, prepaidInterestAmount: -1 })).toThrow(
      'pozitif'
    );
    expect(() =>
      calculateLoan({ ...input, prepaidInterestAmount: 999999 })
    ).toThrow('azami');

    const valid = calculateLoan({ ...input, prepaidInterestAmount: 50000 });
    expect(valid.schedule[0].installmentNumber).toBe(0);
    expect(valid.schedule[0].kkdf).toBeGreaterThan(0);
    expect(valid.schedule[0].bsmv).toBeGreaterThan(0);
    expectValidResult(valid, input.principal, input.term + 1);
  });

  it('red-teams interest-only validation and shortened schedules', () => {
    const input = {
      principal: 250000,
      term: 12,
      monthlyInterestRatePercent: 4.3,
      kkdfRatePercent: 15,
      bsmvRatePercent: 15,
      creditUsageDate: new Date(2026, 5, 25),
      firstInstallmentDate: new Date(2026, 7, 1),
      planType: 'interestOnly' as const,
    };

    [undefined, 0, -1, 1.5, 12, 13].forEach((interestOnlyInstallmentCount) => {
      expect(() =>
        calculateLoan({ ...input, interestOnlyInstallmentCount })
      ).toThrow();
    });

    const result = calculateLoan({ ...input, interestOnlyInstallmentCount: 6 });
    expect(result.schedule).toHaveLength(11);
    expect(result.schedule.slice(0, 6).every((item) => item.principal === 0)).toBe(
      true
    );
    expectValidResult(result, input.principal, input.term);
  });

  it('red-teams increasing installment validation and yearly frequency behavior', () => {
    const input = {
      ...baseInput,
      principal: 1000000,
      term: 60,
      monthlyInterestRatePercent: 3.1,
      kkdfRatePercent: 0,
      bsmvRatePercent: 0,
      planType: 'increasingInstallment' as const,
      installmentIncreaseRatePercent: 5,
    };

    [undefined, 0, -1, 1.5, 61].forEach((installmentIncreaseFrequencyMonths) => {
      expect(() =>
        calculateLoan({ ...input, installmentIncreaseFrequencyMonths })
      ).toThrow();
    });

    const yearlyFive = calculateLoan({
      ...input,
      installmentIncreaseFrequencyMonths: 12,
      installmentIncreaseStartNo: 1,
      installmentIncreaseEndNo: 60,
    });
    const yearlyTen = calculateLoan({
      ...input,
      installmentIncreaseRatePercent: 10,
      installmentIncreaseFrequencyMonths: 12,
      installmentIncreaseStartNo: 1,
      installmentIncreaseEndNo: 60,
    });

    expect(yearlyFive.schedule[0].installment).toBe(34560.06);
    expect(yearlyFive.schedule[12].installment).toBeGreaterThan(
      yearlyFive.schedule[11].installment
    );
    expect(yearlyTen.schedule[0].installment).toBeGreaterThan(0);
    expectValidResult(yearlyFive, input.principal, input.term);
    expectValidResult(yearlyTen, input.principal, input.term);
  });

  it('red-teams custom/balloon segment recalculation and invalid custom payments', () => {
    const validCases: LoanInput[] = [
      {
        ...baseInput,
        principal: 3000000,
        term: 60,
        monthlyInterestRatePercent: 3.1,
        planType: 'customPayment',
        customPayments: [{ installmentNo: 6, amount: 1000000 }],
      },
      {
        ...baseInput,
        principal: 100000,
        term: 12,
        monthlyInterestRatePercent: 2,
        planType: 'customPayment',
        customPayments: [{ installmentNo: 12, amount: 50000 }],
      },
      {
        ...baseInput,
        principal: 3000000,
        term: 60,
        monthlyInterestRatePercent: 3.1,
        planType: 'customPayment',
        customPayments: [
          { installmentNo: 1, amount: 93000 },
          { installmentNo: 2, amount: 93000 },
          { installmentNo: 3, amount: 93000 },
          { installmentNo: 4, amount: 93000 },
          { installmentNo: 5, amount: 93000 },
          { installmentNo: 6, amount: 1000000 },
        ],
      },
      {
        ...baseInput,
        principal: 500000,
        term: 24,
        monthlyInterestRatePercent: 2.5,
        planType: 'customPayment',
        customPayments: [
          { installmentNo: 6, amount: 100000 },
          { installmentNo: 12, amount: 75000 },
        ],
      },
      {
        ...baseInput,
        principal: 100000,
        term: 12,
        monthlyInterestRatePercent: 2,
        planType: 'customPayment',
        customPayments: [
          { installmentNo: 6, amount: 20000 },
          { installmentNo: 12, amount: 30000 },
        ],
      },
      {
        ...baseInput,
        principal: 100000,
        term: 12,
        monthlyInterestRatePercent: 3,
        kkdfRatePercent: 15,
        bsmvRatePercent: 15,
        planType: 'customPayment',
        customPayments: [{ installmentNo: 1, amount: 3900 }],
      },
      {
        ...baseInput,
        principal: 100000,
        term: 12,
        monthlyInterestRatePercent: 2,
        planType: 'customPayment',
        customPayments: [{ installmentNo: 1, amount: 20000 }],
      },
      {
        ...baseInput,
        principal: 300000,
        term: 24,
        monthlyInterestRatePercent: 2.75,
        planType: 'customPayment',
        customPayments: [
          { installmentNo: 5, amount: 20000 },
          { installmentNo: 6, amount: 25000 },
          { installmentNo: 7, amount: 30000 },
        ],
      },
      {
        ...baseInput,
        principal: 100000,
        term: 3,
        monthlyInterestRatePercent: 2,
        planType: 'customPayment',
        customPayments: [
          { installmentNo: 1, amount: 30000 },
          { installmentNo: 2, amount: 30000 },
          { installmentNo: 3, amount: 44308.8 },
        ],
      },
    ];

    validCases.forEach((input) => {
      const result = calculateLoan(input);

      expectValidResult(result, input.principal, input.term);
    });

    expect(() =>
      calculateLoan({
        ...baseInput,
        principal: 3000000,
        term: 60,
        monthlyInterestRatePercent: 3.1,
        planType: 'customPayment',
        customPayments: [{ installmentNo: 1, amount: 92999.99 }],
      })
    ).toThrow('faiz ve vergi');
    expect(() =>
      calculateLoan({
        ...baseInput,
        principal: 100000,
        term: 12,
        monthlyInterestRatePercent: 2,
        planType: 'customPayment',
        customPayments: [{ installmentNo: 1, amount: 103000 }],
      })
    ).toThrow('negatife');
    expect(() =>
      calculateLoan({
        ...baseInput,
        principal: 100000,
        term: 3,
        monthlyInterestRatePercent: 2,
        planType: 'customPayment',
        customPayments: [
          { installmentNo: 1, amount: 2000 },
          { installmentNo: 2, amount: 2000 },
          { installmentNo: 3, amount: 2000 },
        ],
      })
    ).toThrow('vade sonunda');
  });

  it('red-teams custom payment form validation before engine calls', () => {
    expect(() => buildCustomPaymentsFromRows([], 12)).toThrow('En az');
    expect(() =>
      buildCustomPaymentsFromRows([{ installmentNo: '', amount: '10.000' }], 12)
    ).toThrow('boş');
    expect(() =>
      buildCustomPaymentsFromRows([{ installmentNo: '0', amount: '10.000' }], 12)
    ).toThrow('pozitif');
    expect(() =>
      buildCustomPaymentsFromRows([{ installmentNo: '-1', amount: '10.000' }], 12)
    ).toThrow('pozitif');
    expect(() =>
      buildCustomPaymentsFromRows([{ installmentNo: '1,5', amount: '10.000' }], 12)
    ).toThrow('tam sayı');
    expect(() =>
      buildCustomPaymentsFromRows([{ installmentNo: '13', amount: '10.000' }], 12)
    ).toThrow('1 ile vade');
    expect(() =>
      buildCustomPaymentsFromRows(
        [
          { installmentNo: '1', amount: '10.000' },
          { installmentNo: '1', amount: '20.000' },
        ],
        12
      )
    ).toThrow('birden fazla');
    expect(() =>
      buildCustomPaymentsFromRows([{ installmentNo: '1', amount: '' }], 12)
    ).toThrow('boş');
    expect(() =>
      buildCustomPaymentsFromRows([{ installmentNo: '1', amount: '0' }], 12)
    ).toThrow('pozitif');
    expect(() =>
      buildCustomPaymentsFromRows([{ installmentNo: '1', amount: '-1' }], 12)
    ).toThrow('pozitif');
  });
});
