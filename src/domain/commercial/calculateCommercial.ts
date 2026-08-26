import { calculateCommercialDiscount } from './calculateDiscount';
import { calculateCommercialInstallment } from './calculateInstallment';
import { calculateCommercialRevolving } from './calculateRevolving';
import { calculateCommercialSpot } from './calculateSpot';
import type { CommercialInput, CommercialResult } from './types';

export const calculateCommercial = (input: CommercialInput): CommercialResult => {
  switch (input.productType) {
    case 'commercial_installment':
      return calculateCommercialInstallment(input);
    case 'commercial_spot':
      return calculateCommercialSpot(input);
    case 'commercial_revolving':
      return calculateCommercialRevolving(input);
    case 'commercial_discount':
      return calculateCommercialDiscount(input);
    default:
      throw new Error('Desteklenmeyen ticari kredi türü.');
  }
};
