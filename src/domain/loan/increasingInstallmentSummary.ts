import type { LoanCalculationResult } from './types';

export const INCREASING_INSTALLMENT_PLAN_LABEL = 'Artan Taksitli Plan';

export const getFirstIncreasedInstallmentAmount = (
  result: LoanCalculationResult
): number => {
  if (result.planType !== 'increasingInstallment') {
    return 0;
  }

  const frequencyMonths = result.installmentIncreaseFrequencyMonths ?? 12;
  return (
    result.schedule[frequencyMonths]?.installment ??
    result.lastInstallmentAmount ??
    result.firstInstallmentAmount ??
    result.firstInstallment
  );
};
