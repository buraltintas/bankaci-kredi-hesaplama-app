import type { LoanCalculationResult } from './types';

export const INCREASING_INSTALLMENT_PLAN_LABEL = 'Artan Taksitli Plan';

export const getFirstIncreasedInstallmentAmount = (
  result: LoanCalculationResult
): number => {
  if (result.planType !== 'increasingInstallment') {
    return 0;
  }

  const frequencyMonths = result.installmentIncreaseFrequencyMonths ?? 12;
  const startNo = result.installmentIncreaseStartNo ?? 1;
  const firstIncreaseInstallmentNo = startNo + frequencyMonths;

  return (
    result.schedule[firstIncreaseInstallmentNo - 1]?.installment ??
    result.lastInstallmentAmount ??
    result.firstInstallmentAmount ??
    result.firstInstallment
  );
};
