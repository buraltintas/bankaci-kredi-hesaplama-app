import { assertMoney, assertRate, roundMoney } from './money';
import {
  calculateAct360Interest,
  requirePositiveDayRange,
  sumBreakdown,
  validateTaxConfig,
} from './common';
import type { CommercialSpotInput, CommercialSpotResult } from './types';

export const calculateCommercialSpot = (
  input: CommercialSpotInput
): CommercialSpotResult => {
  assertMoney(input.principal, 'Kredi tutarı');
  assertRate(input.annualInterestRatePercent, 'Yıllık faiz oranı');
  validateTaxConfig(input);
  const dayCount = requirePositiveDayRange(
    input.creditUsageDate,
    input.maturityDate,
    'Kullandırım tarihi',
    'Vade tarihi'
  );
  const interest = calculateAct360Interest(
    input.principal,
    input.annualInterestRatePercent,
    dayCount
  );
  const breakdown = sumBreakdown(interest, input);
  return {
    productType: 'commercial_spot',
    input,
    dayCount,
    ...breakdown,
    maturityPayment: roundMoney(input.principal + breakdown.totalFinancingCost),
    dayCountConvention: 'ACT/360',
  };
};
