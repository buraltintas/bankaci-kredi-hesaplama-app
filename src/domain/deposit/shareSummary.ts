import { formatCurrency } from '../../utils/formatCurrency';
import { formatDate } from '../../utils/dateMath';
import type { DepositCalculationResult } from './types';

const formatPercent = (value: number, decimals = 2): string => {
  return `%${value.toLocaleString('tr-TR', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: 0,
  })}`;
};

export const buildDepositShareMessage = (
  result: DepositCalculationResult
): string => {
  return `Mevduat Hesaplama Sonucu

Anapara: ${formatCurrency(result.principal)}
Vade: ${result.termDays} gün
Yıllık brüt faiz oranı: ${formatPercent(result.annualInterestRatePercent)}
Vade sonu tarihi: ${formatDate(result.maturityDate)}

Brüt faiz: ${formatCurrency(result.grossInterest)}
Stopaj (${formatPercent(result.withholdingTaxRatePercent)}): -${formatCurrency(
    result.withholdingTax
  )}
Net faiz: ${formatCurrency(result.netInterest)}
Vade sonu toplam: ${formatCurrency(result.maturityAmount)}
Net yıllık getiri: ${formatPercent(result.effectiveAnnualNetRatePercent)}`;
};
