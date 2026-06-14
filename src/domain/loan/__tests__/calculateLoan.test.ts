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

describe('calculateLoan', () => {
  it('generates a standard equal installment schedule', () => {
    const result = calculateLoan(baseInput);

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
});
