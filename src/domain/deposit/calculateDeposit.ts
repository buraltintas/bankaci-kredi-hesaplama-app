import { roundToCents } from '../../utils/round';
import { startOfLocalDay } from '../../utils/dateMath';
import type { DepositCalculationResult, DepositInput } from './types';

/**
 * Turkish banks accrue time-deposit interest on a 365-day year with simple
 * interest, so a 32-day deposit earns 32/365 of the annual rate rather than a
 * compounded month. Compounding here would overstate what the customer
 * actually receives.
 */
export const DEPOSIT_DAY_COUNT_BASIS = 365;

const isUsableNumber = (value: number): boolean => {
  return Number.isFinite(value) && value >= 0;
};

const addDays = (date: Date, days: number): Date => {
  const result = startOfLocalDay(date);
  result.setDate(result.getDate() + days);

  return result;
};

export const calculateDeposit = (
  input: DepositInput
): DepositCalculationResult => {
  const {
    principal,
    annualInterestRatePercent,
    termDays,
    withholdingTaxRatePercent,
    startDate,
  } = input;

  if (!isUsableNumber(principal) || principal <= 0) {
    throw new Error('Anapara sıfırdan büyük olmalıdır.');
  }

  if (!Number.isFinite(termDays) || termDays <= 0) {
    throw new Error('Vade en az 1 gün olmalıdır.');
  }

  if (!isUsableNumber(annualInterestRatePercent)) {
    throw new Error('Faiz oranı negatif olamaz.');
  }

  if (
    !isUsableNumber(withholdingTaxRatePercent) ||
    withholdingTaxRatePercent > 100
  ) {
    throw new Error('Stopaj oranı %0 ile %100 arasında olmalıdır.');
  }

  const wholeTermDays = Math.floor(termDays);

  const grossInterest = roundToCents(
    (principal * (annualInterestRatePercent / 100) * wholeTermDays) /
      DEPOSIT_DAY_COUNT_BASIS
  );
  const withholdingTax = roundToCents(
    grossInterest * (withholdingTaxRatePercent / 100)
  );
  // Derived by subtraction rather than its own rounded formula, so the three
  // figures always reconcile: gross - tax = net, to the cent.
  const netInterest = roundToCents(grossInterest - withholdingTax);
  const maturityAmount = roundToCents(principal + netInterest);

  const effectiveAnnualNetRatePercent =
    (netInterest / principal) * (DEPOSIT_DAY_COUNT_BASIS / wholeTermDays) * 100;

  return {
    principal: roundToCents(principal),
    termDays: wholeTermDays,
    annualInterestRatePercent,
    withholdingTaxRatePercent,
    grossInterest,
    withholdingTax,
    netInterest,
    maturityAmount,
    maturityDate: addDays(startDate, wholeTermDays),
    effectiveAnnualNetRatePercent,
  };
};
