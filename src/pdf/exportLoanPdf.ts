import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { formatDateForFileName } from '../utils/dateMath';
import type { LoanCalculationResult } from '../domain/loan/types';
import { createLoanPdfHtml, LoanPdfContactInfo } from './createLoanPdfHtml';

const createShortId = (): string => {
  return Math.random().toString(36).slice(2, 8);
};

export const exportLoanPdf = async (
  result: LoanCalculationResult,
  contactInfo?: LoanPdfContactInfo
): Promise<void> => {
  const html = createLoanPdfHtml(result, contactInfo);
  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  });
  const namedUri = `${FileSystem.cacheDirectory}${createLoanPdfFileName(result)}`;

  await FileSystem.copyAsync({
    from: uri,
    to: namedUri,
  });

  const isAvailable = await Sharing.isAvailableAsync();

  if (!isAvailable) {
    throw new Error('Bu cihazda PDF paylaşımı desteklenmiyor.');
  }

  await Sharing.shareAsync(namedUri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Kredi ödeme planını paylaş',
    UTI: 'com.adobe.pdf',
  });
};

export const createLoanPdfFileName = (
  result: LoanCalculationResult,
  id = createShortId()
): string => {
  const principal = Math.round(result.input.principal)
    .toString()
    .replace(/\D/g, '');
  const creditUsageDate = formatDateForFileName(result.input.creditUsageDate);
  const firstInstallmentDate = formatDateForFileName(
    result.input.firstInstallmentDate
  );

  return [
    'kredi-odeme-plani',
    `${principal}tl`,
    `${result.input.term}ay`,
    `kullanim-${creditUsageDate}`,
    `ilk-${firstInstallmentDate}`,
    id,
  ].join('-') + '.pdf';
};
