import { addMonths, daysBetween } from '../../utils/dateMath';
import { roundToCents } from '../../utils/round';
import type {
  BrokenPeriodInfo,
  LoanCalculationResult,
  LoanInput,
  PaymentScheduleItem,
} from './types';

const calculateStandardInstallment = (
  principal: number,
  term: number,
  monthlyInterestRate: number,
  kkdfRate: number,
  bsmvRate: number
): number => {
  const effectiveMonthlyRate = monthlyInterestRate * (1 + kkdfRate + bsmvRate);

  if (effectiveMonthlyRate === 0) {
    return roundToCents(principal / term);
  }

  const power = Math.pow(1 + effectiveMonthlyRate, term);

  return roundToCents(
    (principal * effectiveMonthlyRate * power) / (power - 1)
  );
};

const buildStandardSchedule = (
  input: LoanInput,
  standardInstallment: number,
  monthlyInterestRate: number,
  kkdfRate: number,
  bsmvRate: number
): PaymentScheduleItem[] => {
  let remainingPrincipal = input.principal;

  return Array.from({ length: input.term }, (_, index) => {
    const installmentNumber = index + 1;
    const isLastInstallment = installmentNumber === input.term;
    const interest = roundToCents(remainingPrincipal * monthlyInterestRate);
    const kkdf = roundToCents(interest * kkdfRate);
    const bsmv = roundToCents(interest * bsmvRate);
    const calculatedPrincipal = roundToCents(
      standardInstallment - interest - kkdf - bsmv
    );
    const principal = isLastInstallment
      ? roundToCents(remainingPrincipal)
      : calculatedPrincipal;
    const installment = isLastInstallment
      ? roundToCents(principal + interest + kkdf + bsmv)
      : standardInstallment;

    remainingPrincipal = roundToCents(remainingPrincipal - principal);

    if (isLastInstallment || Math.abs(remainingPrincipal) < 0.01) {
      remainingPrincipal = 0;
    }

    return {
      installmentNumber,
      date: addMonths(input.firstInstallmentDate, index),
      installment,
      principal,
      interest,
      kkdf,
      bsmv,
      remainingPrincipal,
    };
  });
};

const calculateBrokenPeriod = (
  input: LoanInput,
  monthlyInterestRate: number,
  kkdfRate: number,
  bsmvRate: number
): BrokenPeriodInfo => {
  const standardFirstInstallmentDate = addMonths(input.creditUsageDate, 1);
  const diffDays = daysBetween(
    standardFirstInstallmentDate,
    input.firstInstallmentDate
  );
  const dailyInterestRate = monthlyInterestRate / 30;
  const interestDiff = roundToCents(input.principal * dailyInterestRate * diffDays);
  const kkdfDiff = roundToCents(interestDiff * kkdfRate);
  const bsmvDiff = roundToCents(interestDiff * bsmvRate);

  return {
    standardFirstInstallmentDate,
    actualFirstInstallmentDate: input.firstInstallmentDate,
    diffDays,
    interestDiff,
    kkdfDiff,
    bsmvDiff,
    totalDiff: roundToCents(interestDiff + kkdfDiff + bsmvDiff),
  };
};

export const calculateLoan = (input: LoanInput): LoanCalculationResult => {
  if (input.principal <= 0) {
    throw new Error('Kredi tutarı pozitif olmalıdır.');
  }

  if (!Number.isInteger(input.term) || input.term <= 0) {
    throw new Error('Vade pozitif tam sayı olmalıdır.');
  }

  if (
    input.monthlyInterestRatePercent < 0 ||
    input.kkdfRatePercent < 0 ||
    input.bsmvRatePercent < 0
  ) {
    throw new Error('Oranlar negatif olamaz.');
  }

  if (input.firstInstallmentDate < input.creditUsageDate) {
    throw new Error('İlk taksit tarihi kredi kullanım tarihinden önce olamaz.');
  }

  const monthlyInterestRate = input.monthlyInterestRatePercent / 100;
  const kkdfRate = input.kkdfRatePercent / 100;
  const bsmvRate = input.bsmvRatePercent / 100;
  const standardInstallment = calculateStandardInstallment(
    input.principal,
    input.term,
    monthlyInterestRate,
    kkdfRate,
    bsmvRate
  );
  const standardSchedule = buildStandardSchedule(
    input,
    standardInstallment,
    monthlyInterestRate,
    kkdfRate,
    bsmvRate
  );
  const brokenPeriod = calculateBrokenPeriod(
    input,
    monthlyInterestRate,
    kkdfRate,
    bsmvRate
  );
  const schedule = standardSchedule.map((item) => {
    if (item.installmentNumber !== 1 || brokenPeriod.diffDays === 0) {
      return item;
    }

    const interest = roundToCents(item.interest + brokenPeriod.interestDiff);
    const kkdf = roundToCents(item.kkdf + brokenPeriod.kkdfDiff);
    const bsmv = roundToCents(item.bsmv + brokenPeriod.bsmvDiff);

    return {
      ...item,
      interest,
      kkdf,
      bsmv,
      installment: roundToCents(item.principal + interest + kkdf + bsmv),
    };
  });

  const totals = schedule.reduce(
    (accumulator, item) => ({
      totalPayment: roundToCents(accumulator.totalPayment + item.installment),
      totalPrincipal: roundToCents(accumulator.totalPrincipal + item.principal),
      totalInterest: roundToCents(accumulator.totalInterest + item.interest),
      totalKkdf: roundToCents(accumulator.totalKkdf + item.kkdf),
      totalBsmv: roundToCents(accumulator.totalBsmv + item.bsmv),
    }),
    {
      totalPayment: 0,
      totalPrincipal: 0,
      totalInterest: 0,
      totalKkdf: 0,
      totalBsmv: 0,
    }
  );

  return {
    input,
    standardInstallment,
    firstInstallment: schedule[0]?.installment ?? 0,
    schedule,
    brokenPeriod,
    ...totals,
  };
};
