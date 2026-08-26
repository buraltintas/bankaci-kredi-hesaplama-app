import { formatCurrency } from '../../utils/formatCurrency';
import { formatDate } from '../../utils/dateMath';
import { COMMERCIAL_PRODUCT_LABELS, type CommercialResult } from './types';

const taxLines = (result: CommercialResult): string[] => [
  `Faiz/iskonto: ${formatCurrency(result.interest)}`,
  `BSMV: ${formatCurrency(result.bsmv)}`,
  `KKDF: ${formatCurrency(result.kkdf)}`,
  `Diğer vergi/fon: ${formatCurrency(result.otherTax)}`,
  `Toplam finansman maliyeti: ${formatCurrency(result.totalFinancingCost)}`,
];

export const buildCommercialShareMessage = (result: CommercialResult): string => {
  const header = `Bankacı · ${COMMERCIAL_PRODUCT_LABELS[result.productType]}`;
  let lines: string[];
  switch (result.productType) {
    case 'commercial_installment':
      lines = [
        `Kredi tutarı: ${formatCurrency(result.input.principal)}`,
        `Aylık faiz: %${result.input.monthlyInterestRatePercent}`,
        `Taksit sayısı: ${result.installmentCount}`,
        `İlk taksit: ${formatCurrency(result.firstInstallment)}`,
        `Toplam geri ödeme: ${formatCurrency(result.totalRepayment)}`,
      ];
      break;
    case 'commercial_spot':
      lines = [
        `Kredi tutarı: ${formatCurrency(result.input.principal)}`,
        `Dönem: ${formatDate(result.input.creditUsageDate)} - ${formatDate(result.input.maturityDate)}`,
        `Vade sonu ödeme: ${formatCurrency(result.maturityPayment)}`,
      ];
      break;
    case 'commercial_revolving':
      lines = [
        `Hesaplama biçimi: ${result.input.mode === 'movements' ? 'Hareketli hesap' : 'Basit hesap'}`,
        `Dönem: ${formatDate(result.input.startDate)} - ${formatDate(result.input.endDate)}`,
        `Dönem sayısı: ${result.periods.length}`,
        `Kapanış bakiyesi: ${formatCurrency(result.closingBalance)}`,
      ];
      if (result.input.mode === 'movements') {
        lines.push(
          '',
          'Hesap hareketleri:',
          ...(result.input.movements ?? []).map(
            (movement) =>
              `${formatDate(movement.date)} · ${movement.amount >= 0 ? 'Kullanım' : 'Geri ödeme'} · ${movement.amount < 0 ? '−' : '+'}${formatCurrency(Math.abs(movement.amount))}`
          )
        );
      }
      break;
    case 'commercial_discount':
      lines = [
        `Belge: ${result.input.documentType === 'cheque' ? 'Çek' : 'Senet'}`,
        `Nominal tutar: ${formatCurrency(result.nominalAmount)}`,
        `Vade: ${formatDate(result.input.maturityDate)}`,
        `Toplam kesinti: ${formatCurrency(result.totalDeduction)}`,
        `Net tutar: ${formatCurrency(result.netProceeds)}`,
      ];
      break;
  }
  return [header, '', ...lines, ...taxLines(result), '', 'Bu çıktı matematiksel hesaplama amaçlıdır; kredi teklifi veya finansal tavsiye değildir.'].join('\n');
};
