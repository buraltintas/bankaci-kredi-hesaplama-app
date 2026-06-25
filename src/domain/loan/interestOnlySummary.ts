import { roundToCents } from '../../utils/round';
import type { LoanCalculationResult } from './types';

export const INTEREST_ONLY_PLAN_LABEL = 'Anapara Ödemesiz Dönemli Plan';

export const getInterestOnlyEffectiveInstallmentInfo = (
  result: LoanCalculationResult
): string | null => {
  if (
    result.planType !== 'interestOnly' ||
    result.schedule.length === result.input.term
  ) {
    return null;
  }

  return `Girilen vade: ${result.input.term} ay
Ödeme planı taksit sayısı: ${result.schedule.length}
İlk taksit tarihi nedeniyle toplam vade aşılmaması için taksit sayısı ${result.schedule.length} olarak hesaplandı.`;
};

export const getInterestOnlyPeriodInstallmentAmount = (
  result: LoanCalculationResult
): number => {
  const regularInterestOnlyRow = result.schedule.find(
    (item) => item.isInterestOnly && item.installmentNumber !== 1
  );

  if (regularInterestOnlyRow) {
    return regularInterestOnlyRow.installment;
  }

  const firstInterestOnlyRow = result.schedule.find((item) => item.isInterestOnly);

  if (!firstInterestOnlyRow) {
    return 0;
  }

  if (result.brokenPeriod.diffDays === 0) {
    return firstInterestOnlyRow.installment;
  }

  const interest = roundToCents(
    result.input.principal * (result.input.monthlyInterestRatePercent / 100)
  );
  const kkdf = roundToCents(interest * (result.input.kkdfRatePercent / 100));
  const bsmv = roundToCents(interest * (result.input.bsmvRatePercent / 100));

  return roundToCents(interest + kkdf + bsmv);
};
