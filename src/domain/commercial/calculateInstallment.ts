import { addMonths, daysBetween, startOfLocalDay } from '../../utils/dateMath';
import { MAX_COMMERCIAL_DAY_COUNT, calculateTaxes, requireValidDate, validateTaxConfig } from './common';
import {
  assertMoney,
  assertRate,
  decimal,
  roundMoney,
  roundMoneyDecimal,
} from './money';
import type {
  CommercialInstallmentInput,
  CommercialInstallmentResult,
  CommercialInstallmentScheduleItem,
} from './types';

const calculateAnnuity = (
  principal: number,
  monthlyRatePercent: number,
  frequencyMonths: number,
  count: number,
  totalTaxRatePercent: number
): number => {
  const basePeriodRate = decimal(monthlyRatePercent)
    .mul(frequencyMonths)
    .div(100);
  const grossPeriodRate = basePeriodRate.mul(
    decimal(1).add(decimal(totalTaxRatePercent).div(100))
  );
  if (grossPeriodRate.isZero()) {
    return roundMoney(decimal(principal).div(count));
  }
  const factor = decimal(1).add(grossPeriodRate).pow(count);
  return roundMoney(
    decimal(principal)
      .mul(grossPeriodRate)
      .mul(factor)
      .div(factor.minus(1))
  );
};

export const calculateCommercialInstallment = (
  input: CommercialInstallmentInput
): CommercialInstallmentResult => {
  assertMoney(input.principal, 'Kredi tutarı');
  assertRate(input.monthlyInterestRatePercent, 'Aylık faiz oranı');
  validateTaxConfig(input);
  if (!Number.isInteger(input.termMonths) || input.termMonths <= 0 || input.termMonths > 360) {
    throw new Error('Vade 1 ile 360 ay arasında tam sayı olmalıdır.');
  }
  if (![1, 3, 6].includes(input.paymentFrequencyMonths)) {
    throw new Error('Ödeme sıklığı aylık, 3 aylık veya 6 aylık olmalıdır.');
  }
  if (input.termMonths % input.paymentFrequencyMonths !== 0) {
    throw new Error('Vade, ödeme sıklığının tam katı olmalıdır.');
  }
  const usageDate = requireValidDate(input.creditUsageDate, 'Kullandırım tarihi');
  const firstDate = requireValidDate(input.firstInstallmentDate, 'İlk taksit tarihi');
  const firstPeriodDayCount = daysBetween(usageDate, firstDate);
  if (firstPeriodDayCount <= 0) {
    throw new Error('İlk taksit tarihi kullandırım tarihinden sonra olmalıdır.');
  }
  if (firstPeriodDayCount > MAX_COMMERCIAL_DAY_COUNT) {
    throw new Error(`İlk taksit dönemi ${MAX_COMMERCIAL_DAY_COUNT} günü aşamaz.`);
  }

  const installmentCount = input.termMonths / input.paymentFrequencyMonths;
  const totalTaxRate =
    input.bsmvRatePercent + input.kkdfRatePercent + input.otherTaxRatePercent;
  const regularInstallment = calculateAnnuity(
    input.principal,
    input.monthlyInterestRatePercent,
    input.paymentFrequencyMonths,
    installmentCount,
    totalTaxRate
  );
  const basePeriodRate = decimal(input.monthlyInterestRatePercent)
    .mul(input.paymentFrequencyMonths)
    .div(100);
  const standardFirstDate = startOfLocalDay(
    addMonths(usageDate, input.paymentFrequencyMonths)
  );
  const brokenPeriodDays = daysBetween(standardFirstDate, firstDate);
  const brokenInterest = roundMoney(
    decimal(input.principal)
      .mul(input.monthlyInterestRatePercent)
      .mul(brokenPeriodDays)
      .div(3_000)
  );
  const brokenTaxes = calculateTaxes(brokenInterest, input);
  const firstInstallmentAdjustment = roundMoney(
    brokenInterest + brokenTaxes.bsmv + brokenTaxes.kkdf + brokenTaxes.otherTax
  );

  const schedule: CommercialInstallmentScheduleItem[] = [];
  let remaining = roundMoneyDecimal(input.principal);
  for (let index = 0; index < installmentCount; index += 1) {
    const isLast = index === installmentCount - 1;
    const regularInterest = roundMoney(remaining.mul(basePeriodRate));
    const regularTaxes = calculateTaxes(regularInterest, input);
    const contractualInstallment = roundMoney(
      regularInstallment + (index === 0 ? firstInstallmentAdjustment : 0)
    );
    let principalPayment = roundMoney(
      decimal(regularInstallment)
        .minus(regularInterest)
        .minus(regularTaxes.bsmv)
        .minus(regularTaxes.kkdf)
        .minus(regularTaxes.otherTax)
    );
    if (index === 0 && regularInterest + brokenInterest < 0) {
      throw new Error('İlk taksit tarihi seçilen ödeme sıklığı için çok erkendir.');
    }
    if (principalPayment < 0) {
      throw new Error('Faiz ve vergi oranları pozitif anapara ödemesi üretmiyor.');
    }
    if (isLast || decimal(principalPayment).greaterThan(remaining)) {
      principalPayment = remaining.toDecimalPlaces(2).toNumber();
    }
    const installment = isLast
      ? roundMoney(
          principalPayment +
            regularInterest +
            regularTaxes.bsmv +
            regularTaxes.kkdf +
            regularTaxes.otherTax +
            (index === 0 ? firstInstallmentAdjustment : 0)
        )
      : contractualInstallment;
    if (installment <= 0) {
      throw new Error('Hesaplanan taksit sıfırdan büyük olmalıdır.');
    }
    remaining = remaining.minus(principalPayment).toDecimalPlaces(2);
    schedule.push({
      installmentNumber: index + 1,
      date: startOfLocalDay(addMonths(firstDate, index * input.paymentFrequencyMonths)),
      installment,
      principal: principalPayment,
      interest: roundMoney(regularInterest + (index === 0 ? brokenInterest : 0)),
      bsmv: roundMoney(regularTaxes.bsmv + (index === 0 ? brokenTaxes.bsmv : 0)),
      kkdf: roundMoney(regularTaxes.kkdf + (index === 0 ? brokenTaxes.kkdf : 0)),
      otherTax: roundMoney(
        regularTaxes.otherTax + (index === 0 ? brokenTaxes.otherTax : 0)
      ),
      totalFinancingCost: roundMoney(
        regularInterest +
          regularTaxes.bsmv +
          regularTaxes.kkdf +
          regularTaxes.otherTax +
          (index === 0 ? firstInstallmentAdjustment : 0)
      ),
      remainingPrincipal: remaining.toNumber(),
    });
  }

  const totals = schedule.reduce(
    (sum, row) => ({
      interest: roundMoney(sum.interest + row.interest),
      bsmv: roundMoney(sum.bsmv + row.bsmv),
      kkdf: roundMoney(sum.kkdf + row.kkdf),
      otherTax: roundMoney(sum.otherTax + row.otherTax),
      totalFinancingCost: roundMoney(sum.totalFinancingCost + row.totalFinancingCost),
      totalRepayment: roundMoney(sum.totalRepayment + row.installment),
    }),
    { interest: 0, bsmv: 0, kkdf: 0, otherTax: 0, totalFinancingCost: 0, totalRepayment: 0 }
  );
  return {
    productType: 'commercial_installment',
    input,
    installmentCount,
    regularInstallment,
    firstInstallment: schedule[0].installment,
    ...totals,
    schedule,
    dayCountConvention: 'contractual-month/ACT-360-broken-period',
    brokenPeriodDays,
  };
};
