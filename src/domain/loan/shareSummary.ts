import { formatCurrency } from '../../utils/formatCurrency';
import { formatDate } from '../../utils/dateMath';
import type { LoanCalculationResult, LoanPlanType } from './types';
import { formatCustomPaymentsSummary } from './customPaymentForm';
import { INCREASING_INSTALLMENT_PLAN_LABEL } from './increasingInstallmentSummary';
import {
  getInterestOnlyEffectiveInstallmentInfo,
  getInterestOnlyPeriodInstallmentAmount,
  INTEREST_ONLY_PLAN_LABEL,
} from './interestOnlySummary';

const PLAN_TYPE_LABELS: Record<LoanPlanType, string> = {
  standard: 'Standart Sabit Taksitli',
  prepaidInterest: 'Peşin Faiz Ödemeli',
  equalPrincipal: 'Eşit Anapara Ödemeli',
  customPayment: 'Özel / Balon Ödeme Planı',
  interestOnly: INTEREST_ONLY_PLAN_LABEL,
  increasingInstallment: INCREASING_INSTALLMENT_PLAN_LABEL,
};

const formatDiscountedRate = (value: number | undefined): string =>
  `%${((value ?? 0) * 100).toLocaleString('tr-TR', {
    maximumFractionDigits: 3,
    minimumFractionDigits: 3,
  })}`;

const buildPlanSpecificLines = (result: LoanCalculationResult): string => {
  if (result.planType === 'customPayment') {
    return `Otomatik taksit: ${formatCurrency(result.automaticInstallmentAmount ?? 0)}
Özel ödeme sayısı: ${result.input.customPayments?.length ?? 0}
Toplam ödeme: ${formatCurrency(result.totalPayment)}
Plan Tipi: ${PLAN_TYPE_LABELS.customPayment}
Özel Ödemeler:
${formatCustomPaymentsSummary(result.input.customPayments ?? [])}`;
  }

  if (result.planType === 'equalPrincipal') {
    return `Aylık anapara: ${formatCurrency(result.monthlyPrincipalAmount ?? 0)}
İlk taksit: ${formatCurrency(result.firstInstallmentAmount ?? result.firstInstallment)}
Son taksit: ${formatCurrency(result.lastInstallmentAmount ?? 0)}
Toplam ödeme: ${formatCurrency(result.totalPayment)}
Plan Tipi: ${PLAN_TYPE_LABELS.equalPrincipal}`;
  }

  if (result.planType === 'interestOnly') {
    const effectiveInstallmentInfo =
      getInterestOnlyEffectiveInstallmentInfo(result);

    return `Anapara ödemesiz taksit sayısı: ${
      result.interestOnlyInstallmentCount ?? 0
    }
Anapara ödemesiz dönem taksiti: ${formatCurrency(
      getInterestOnlyPeriodInstallmentAmount(result)
    )}
Sonraki dönem taksiti: ${formatCurrency(
      result.postInterestOnlyInstallmentAmount ?? 0
    )}
Toplam ödeme: ${formatCurrency(result.totalPayment)}
Plan Tipi: ${PLAN_TYPE_LABELS.interestOnly}${
      effectiveInstallmentInfo ? `\n${effectiveInstallmentInfo}` : ''
    }`;
  }

  if (result.planType === 'increasingInstallment') {
    return `Taksit artış oranı: %${result.installmentIncreaseRatePercent ?? 0}
Artış sıklığı: ${result.installmentIncreaseFrequencyMonths ?? 12} ay
İlk taksit: ${formatCurrency(result.firstInstallmentAmount ?? result.firstInstallment)}
Son taksit: ${formatCurrency(result.lastInstallmentAmount ?? 0)}
Toplam ödeme: ${formatCurrency(result.totalPayment)}
Plan Tipi: ${PLAN_TYPE_LABELS.increasingInstallment}`;
  }

  if (result.planType === 'prepaidInterest') {
    return `İlk taksit: ${formatCurrency(result.firstInstallment)}
Standart aylık taksit: ${formatCurrency(result.standardInstallment)}
Toplam ödeme: ${formatCurrency(result.totalPayment)}
Plan Tipi: ${PLAN_TYPE_LABELS.prepaidInterest}
İndirimli faiz oranı: ${formatDiscountedRate(result.discountedMonthlyRate)}
0. taksit peşin faiz: ${formatCurrency(result.realizedPrepaidInterest ?? 0)}`;
  }

  return `İlk taksit: ${formatCurrency(result.firstInstallment)}
Standart aylık taksit: ${formatCurrency(result.standardInstallment)}
Toplam ödeme: ${formatCurrency(result.totalPayment)}
Plan Tipi: ${PLAN_TYPE_LABELS.standard}`;
};

export const buildLoanShareMessage = (result: LoanCalculationResult): string => {
  const brokenPeriodNote =
    result.brokenPeriod.diffDays !== 0
      ? '\nİlk taksit tarihine bağlı kırık dönem farkı sadece 1. taksite yansıtılmıştır.'
      : '';

  return `Kredi kullanım tarihi: ${formatDate(result.input.creditUsageDate)}
İlk taksit tarihi: ${formatDate(result.input.firstInstallmentDate)}
Kredi tutarı: ${formatCurrency(result.input.principal)}
Vade: ${result.input.term} ay
Faiz: %${result.input.monthlyInterestRatePercent}
KKDF: %${result.input.kkdfRatePercent} | BSMV: %${result.input.bsmvRatePercent}
${buildPlanSpecificLines(result)}${brokenPeriodNote}`;
};
