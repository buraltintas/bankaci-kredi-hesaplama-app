import { parseNumericInput } from '../../utils/sanitizeNumericInput';
import type { LoanInput } from './types';

export type CustomPaymentFormRow = {
  installmentNo: string;
  amount: string;
};

const hasNegativeSign = (value: string): boolean => value.trim().startsWith('-');

export const buildCustomPaymentsFromRows = (
  rows: CustomPaymentFormRow[],
  term: number
): NonNullable<LoanInput['customPayments']> => {
  if (rows.length === 0) {
    throw new Error('En az bir özel ödeme satırı girin.');
  }

  const seenInstallments = new Set<number>();

  return rows.map((row) => {
    if (!row.installmentNo.trim()) {
      throw new Error('Özel ödeme taksit no boş olamaz.');
    }

    if (!row.amount.trim()) {
      throw new Error('Özel ödeme tutarı boş olamaz.');
    }

    if (hasNegativeSign(row.installmentNo) || hasNegativeSign(row.amount)) {
      throw new Error('Özel ödeme taksit no ve tutarı pozitif olmalıdır.');
    }

    if (/[,.]/.test(row.installmentNo)) {
      throw new Error('Özel ödeme taksit no pozitif tam sayı olmalıdır.');
    }

    const installmentNo = parseNumericInput(row.installmentNo, 'integer');
    const amount = parseNumericInput(row.amount, 'money');

    if (!installmentNo.isValid || !installmentNo.value) {
      throw new Error('Özel ödeme taksit no pozitif tam sayı olmalıdır.');
    }

    if (installmentNo.value < 1 || installmentNo.value > term) {
      throw new Error('Özel ödeme taksit no 1 ile vade arasında olmalıdır.');
    }

    if (seenInstallments.has(installmentNo.value)) {
      throw new Error('Aynı taksit no için birden fazla özel ödeme girilemez.');
    }

    if (!amount.isValid || !amount.value || amount.value <= 0) {
      throw new Error('Özel ödeme tutarı pozitif olmalıdır.');
    }

    seenInstallments.add(installmentNo.value);

    return {
      installmentNo: installmentNo.value,
      amount: amount.value,
    };
  });
};

export const formatCustomPaymentsSummary = (
  customPayments: NonNullable<LoanInput['customPayments']>
): string =>
  [...customPayments]
    .sort((a, b) => a.installmentNo - b.installmentNo)
    .map(
      (payment) =>
        `${payment.installmentNo}. taksit: ${payment.amount.toLocaleString('tr-TR', {
          maximumFractionDigits: 2,
          minimumFractionDigits: 2,
        })} TL`
    )
    .join('\n');
