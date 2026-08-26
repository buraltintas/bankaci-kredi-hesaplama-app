import { daysBetween, startOfLocalDay } from '../../utils/dateMath';
import { assertRate, decimal, roundMoney, roundMoneyDecimal } from './money';
import type { CommercialMoneyBreakdown, CommercialTaxConfig } from './types';

export const MAX_COMMERCIAL_DAY_COUNT = 3_660;

export const validateTaxConfig = (taxes: CommercialTaxConfig): void => {
  assertRate(taxes.bsmvRatePercent, 'BSMV oranı');
  assertRate(taxes.kkdfRatePercent, 'KKDF oranı');
  assertRate(taxes.otherTaxRatePercent, 'Diğer vergi/fon oranı');
};

export const requireValidDate = (date: Date, label: string): Date => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error(`${label} geçerli olmalıdır.`);
  }
  return startOfLocalDay(date);
};

export const requirePositiveDayRange = (
  from: Date,
  to: Date,
  fromLabel: string,
  toLabel: string
): number => {
  const start = requireValidDate(from, fromLabel);
  const end = requireValidDate(to, toLabel);
  const days = daysBetween(start, end);
  if (days <= 0) {
    throw new Error(`${toLabel}, ${fromLabel.toLocaleLowerCase('tr-TR')} tarihinden sonra olmalıdır.`);
  }
  if (days > MAX_COMMERCIAL_DAY_COUNT) {
    throw new Error(`Hesaplama dönemi ${MAX_COMMERCIAL_DAY_COUNT} günü aşamaz.`);
  }
  return days;
};

export const calculateAct360Interest = (
  principal: number,
  annualRatePercent: number,
  dayCount: number
): number => roundMoney(decimal(principal).mul(annualRatePercent).mul(dayCount).div(36_000));

export const calculateTaxes = (
  interest: number,
  taxes: CommercialTaxConfig
): Omit<CommercialMoneyBreakdown, 'interest'> => {
  const interestDecimal = decimal(interest);
  const bsmv = roundMoney(interestDecimal.mul(taxes.bsmvRatePercent).div(100));
  const kkdf = roundMoney(interestDecimal.mul(taxes.kkdfRatePercent).div(100));
  const otherTax = roundMoney(
    interestDecimal.mul(taxes.otherTaxRatePercent).div(100)
  );
  return {
    bsmv,
    kkdf,
    otherTax,
    totalFinancingCost: roundMoneyDecimal(interestDecimal)
      .add(bsmv)
      .add(kkdf)
      .add(otherTax)
      .toNumber(),
  };
};

export const sumBreakdown = (
  interest: number,
  taxes: CommercialTaxConfig
): CommercialMoneyBreakdown => ({
  interest: roundMoney(interest),
  ...calculateTaxes(interest, taxes),
});
