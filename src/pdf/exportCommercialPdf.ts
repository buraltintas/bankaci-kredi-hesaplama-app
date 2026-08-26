import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import type { CommercialResult } from '../domain/commercial/types';
import { createCommercialPdfHtml, type CommercialPdfContactInfo } from './createCommercialPdfHtml';

export const exportCommercialPdf = async (result: CommercialResult, contactInfo?: CommercialPdfContactInfo) => {
  const { uri } = await Print.printToFileAsync({ html: createCommercialPdfHtml(result, contactInfo), base64: false });
  const target = `${FileSystem.cacheDirectory}ticari-kredi-${result.productType}-${Date.now()}.pdf`;
  await FileSystem.copyAsync({ from: uri, to: target });
  if (!(await Sharing.isAvailableAsync())) throw new Error('Bu cihazda PDF paylaşımı desteklenmiyor.');
  await Sharing.shareAsync(target, { mimeType: 'application/pdf', dialogTitle: 'Ticari hesaplama PDF paylaş', UTI: 'com.adobe.pdf' });
};
