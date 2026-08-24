import { formatCurrency } from '../../utils/formatCurrency';
import type { TransferComparison } from './types';

const formatPercent = (value: number): string =>
  `%${value.toLocaleString('tr-TR', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })}`;

export const buildTransferShareMessage = (
  result: TransferComparison
): string => {
  const outcomeLabel =
    result.savings >= 0 ? 'Tahmini kazanç' : 'Tahmini ek maliyet';

  return `Konut Kredisi Devir Hesaplama Sonucu

${outcomeLabel}: ${formatCurrency(Math.abs(result.savings))}
Kalan anapara (yaklaşık): ${formatCurrency(result.remainingPrincipal)}
Erken ödeme tazminatı (${formatPercent(
    result.compensationRatePercent
  )}): ${formatCurrency(result.compensation)}
Yeni kredi tutarı: ${formatCurrency(result.refinancePrincipal)}
Kalan vade: ${result.remainingTerm} ay

Mevcut taksit: ${formatCurrency(result.currentInstallment)}
Yeni taksit: ${formatCurrency(result.newInstallment)}
Mevcutta kalan toplam ödeme: ${formatCurrency(result.currentTotal)}
Yeni krediyle toplam ödeme: ${formatCurrency(result.newTotal)}

Sonuçlar yaklaşık olup banka masraflarına göre değişebilir.`;
};
