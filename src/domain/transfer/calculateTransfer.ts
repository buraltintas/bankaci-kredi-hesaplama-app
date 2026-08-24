import { roundToCents } from '../../utils/round';
import type {
  TransferComparison,
  TransferFromEstimateInput,
  TransferFromPayoffInput,
} from './types';

/**
 * Housing loans in Turkey carry no KKDF/BSMV, so the arithmetic here is a
 * plain annuity — no tax gross-up like the general loan engine needs.
 */
const annuityInstallment = (
  principal: number,
  term: number,
  monthlyRate: number
): number => {
  if (monthlyRate === 0) {
    return principal / term;
  }

  const growth = Math.pow(1 + monthlyRate, term);

  return (principal * monthlyRate * growth) / (growth - 1);
};

/**
 * Principal still owed after `paidCount` payments of an annuity loan. Equal to
 * the present value of the payments that remain, which is exactly the balance
 * the bank would quote to close early (before compensation).
 */
const remainingPrincipalAfter = (
  principal: number,
  term: number,
  monthlyRate: number,
  paidCount: number
): number => {
  const installment = annuityInstallment(principal, term, monthlyRate);
  const remaining = term - paidCount;

  if (monthlyRate === 0) {
    return installment * remaining;
  }

  return (
    (installment * (1 - Math.pow(1 + monthlyRate, -remaining))) / monthlyRate
  );
};

/**
 * The legal cap on housing-loan early-repayment compensation: 1% when the
 * remaining term is 36 months or less, 2% beyond that. Offered as the default;
 * the caller may override it.
 */
export const suggestCompensationRate = (remainingTerm: number): number => {
  return remainingTerm > 36 ? 2 : 1;
};

const isPositive = (value: number): boolean =>
  Number.isFinite(value) && value > 0;

const isRate = (value: number): boolean =>
  Number.isFinite(value) && value >= 0;

const buildComparison = (params: {
  remainingPrincipal: number;
  compensation: number;
  compensationRatePercent: number;
  currentInstallment: number;
  currentTotal: number;
  remainingTerm: number;
  newMonthlyRate: number;
}): TransferComparison => {
  const {
    remainingPrincipal,
    compensation,
    compensationRatePercent,
    currentInstallment,
    currentTotal,
    remainingTerm,
    newMonthlyRate,
  } = params;

  const refinancePrincipal = remainingPrincipal + compensation;
  const newInstallment = annuityInstallment(
    refinancePrincipal,
    remainingTerm,
    newMonthlyRate
  );
  const newTotal = newInstallment * remainingTerm;

  return {
    remainingPrincipal: roundToCents(remainingPrincipal),
    compensation: roundToCents(compensation),
    compensationRatePercent,
    refinancePrincipal: roundToCents(refinancePrincipal),
    currentInstallment: roundToCents(currentInstallment),
    currentTotal: roundToCents(currentTotal),
    newInstallment: roundToCents(newInstallment),
    newTotal: roundToCents(newTotal),
    savings: roundToCents(currentTotal - newTotal),
    remainingTerm,
  };
};

export const compareFromPayoff = (
  input: TransferFromPayoffInput
): TransferComparison => {
  const {
    payoffAmount,
    commissionIncluded,
    compensationRatePercent,
    currentMonthlyRatePercent,
    newMonthlyRatePercent,
    remainingTerm,
  } = input;

  if (!isPositive(payoffAmount)) {
    throw new Error('Kapama tutarı sıfırdan büyük olmalıdır.');
  }

  if (!Number.isInteger(remainingTerm) || remainingTerm < 1) {
    throw new Error('Kalan vade en az 1 ay olmalıdır.');
  }

  if (!isRate(currentMonthlyRatePercent) || !isRate(newMonthlyRatePercent)) {
    throw new Error('Faiz oranları negatif olamaz.');
  }

  if (!isRate(compensationRatePercent) || compensationRatePercent > 100) {
    throw new Error('Tazminat oranı %0 ile %100 arasında olmalıdır.');
  }

  const compensationRate = compensationRatePercent / 100;

  // A payoff quote that includes compensation bundles remainingPrincipal ×
  // (1 + rate); back it out so the two figures stay consistent.
  const remainingPrincipal = commissionIncluded
    ? payoffAmount / (1 + compensationRate)
    : payoffAmount;
  const compensation = commissionIncluded
    ? payoffAmount - remainingPrincipal
    : payoffAmount * compensationRate;

  const currentInstallment = annuityInstallment(
    remainingPrincipal,
    remainingTerm,
    currentMonthlyRatePercent / 100
  );

  return buildComparison({
    remainingPrincipal,
    compensation,
    compensationRatePercent,
    currentInstallment,
    currentTotal: currentInstallment * remainingTerm,
    remainingTerm,
    newMonthlyRate: newMonthlyRatePercent / 100,
  });
};

export const compareFromEstimate = (
  input: TransferFromEstimateInput
): TransferComparison => {
  const {
    originalPrincipal,
    originalTerm,
    remainingInstallments,
    compensationRatePercent,
    currentMonthlyRatePercent,
    newMonthlyRatePercent,
  } = input;

  if (!isPositive(originalPrincipal)) {
    throw new Error('Kredi tutarı sıfırdan büyük olmalıdır.');
  }

  if (!Number.isInteger(originalTerm) || originalTerm < 1) {
    throw new Error('Vade en az 1 ay olmalıdır.');
  }

  if (
    !Number.isInteger(remainingInstallments) ||
    remainingInstallments < 1 ||
    remainingInstallments > originalTerm
  ) {
    throw new Error('Kalan taksit sayısı vadeyi aşamaz.');
  }

  if (!isRate(currentMonthlyRatePercent) || !isRate(newMonthlyRatePercent)) {
    throw new Error('Faiz oranları negatif olamaz.');
  }

  if (!isRate(compensationRatePercent) || compensationRatePercent > 100) {
    throw new Error('Tazminat oranı %0 ile %100 arasında olmalıdır.');
  }

  const currentMonthlyRate = currentMonthlyRatePercent / 100;
  const paidCount = originalTerm - remainingInstallments;
  const remainingPrincipal = remainingPrincipalAfter(
    originalPrincipal,
    originalTerm,
    currentMonthlyRate,
    paidCount
  );
  const currentInstallment = annuityInstallment(
    originalPrincipal,
    originalTerm,
    currentMonthlyRate
  );
  const compensation = remainingPrincipal * (compensationRatePercent / 100);

  return buildComparison({
    remainingPrincipal,
    compensation,
    compensationRatePercent,
    currentInstallment,
    currentTotal: currentInstallment * remainingInstallments,
    remainingTerm: remainingInstallments,
    newMonthlyRate: newMonthlyRatePercent / 100,
  });
};
