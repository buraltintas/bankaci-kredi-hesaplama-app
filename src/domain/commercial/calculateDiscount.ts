import { assertMoney, assertRate, roundMoney } from './money';
import {
  MAX_COMMERCIAL_DAY_COUNT,
  calculateAct360Interest,
  requirePositiveDayRange,
  sumBreakdown,
  validateTaxConfig,
} from './common';
import type {
  CommercialDiscountInput,
  CommercialDiscountResult,
} from './types';

export const calculateCommercialDiscount = (
  input: CommercialDiscountInput
): CommercialDiscountResult => {
  if (input.documentType !== 'cheque' && input.documentType !== 'promissory_note') {
    throw new Error('Belge türü çek veya senet olmalıdır.');
  }
  assertMoney(input.nominalAmount, 'Nominal tutar');
  assertRate(input.annualDiscountRatePercent, 'Yıllık iskonto oranı');
  validateTaxConfig(input);
  const calendarDayDifference = requirePositiveDayRange(
    input.transactionDate,
    input.maturityDate,
    'İşlem tarihi',
    'Vade tarihi'
  );
  const dayCount = calendarDayDifference + (input.includeTransactionDay ? 1 : 0);
  if (dayCount > MAX_COMMERCIAL_DAY_COUNT) {
    throw new Error(`Hesaplama dönemi ${MAX_COMMERCIAL_DAY_COUNT} günü aşamaz.`);
  }
  const interest = calculateAct360Interest(
    input.nominalAmount,
    input.annualDiscountRatePercent,
    dayCount
  );
  const breakdown = sumBreakdown(interest, input);
  const totalDeduction = breakdown.totalFinancingCost;
  const netProceeds = roundMoney(input.nominalAmount - totalDeduction);
  if (netProceeds <= 0) {
    throw new Error('Toplam kesinti nominal tutardan küçük olmalıdır.');
  }
  return {
    productType: 'commercial_discount',
    input,
    dayCount,
    nominalAmount: input.nominalAmount,
    ...breakdown,
    totalDeduction,
    netProceeds,
    dayCountConvention: 'ACT/360',
  };
};
