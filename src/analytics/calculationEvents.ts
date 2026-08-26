import type { DepositCalculationResult } from '../domain/deposit/types';
import type {
  LoanCalculationResult,
  LoanInput,
} from '../domain/loan/types';
import type { TransferComparison } from '../domain/transfer/types';
import type { CalculationEventInput } from './types';
import type { CommercialResult } from '../domain/commercial/types';

const LOAN_TYPE_KEYS: Record<string, string> = {
  'Bireysel İhtiyaç/Taşıt Kredisi': 'consumer_vehicle',
  'Bireysel Konut Kredisi': 'housing',
  Özel: 'custom',
};

export const buildLoanAnalyticsEvent = ({
  loanType,
  input,
  result,
}: {
  loanType: string;
  input: LoanInput;
  result: LoanCalculationResult;
}): CalculationEventInput => ({
  calculator: 'loan',
  variant: `${LOAN_TYPE_KEYS[loanType] ?? 'custom'}/${result.planType}`,
  metrics: {
    principalAmount: input.principal,
    termValue: input.term,
    primaryRatePercent: input.monthlyInterestRatePercent,
    taxRate1Percent: input.kkdfRatePercent,
    taxRate2Percent: input.bsmvRatePercent,
    resultPayment: result.standardInstallment,
    resultTotal: result.totalPayment,
    resultInterest: result.totalInterest,
  },
  attributes: {
    hasCustomPayments: Boolean(input.customPayments?.length),
    deductedDelayMonths: result.deductedDelayMonths,
    effectiveInstallmentCount: result.effectiveInstallmentCount,
  },
});

export const buildDepositAnalyticsEvent = (
  result: DepositCalculationResult
): CalculationEventInput => ({
  calculator: 'deposit',
  variant: 'term_deposit',
  metrics: {
    principalAmount: result.principal,
    termValue: result.termDays,
    primaryRatePercent: result.annualInterestRatePercent,
    taxRate1Percent: result.withholdingTaxRatePercent,
    resultTotal: result.maturityAmount,
    resultInterest: result.grossInterest,
    resultNetReturn: result.netInterest,
  },
  attributes: { termUnit: 'day' },
});

export const buildTransferAnalyticsEvent = ({
  mode,
  currentRate,
  newRate,
  commissionIncluded,
  result,
}: {
  mode: 'payoff' | 'estimate';
  currentRate: number;
  newRate: number;
  commissionIncluded: boolean;
  result: TransferComparison;
}): CalculationEventInput => ({
  calculator: 'transfer',
  variant: mode,
  metrics: {
    principalAmount: result.remainingPrincipal,
    termValue: result.remainingTerm,
    primaryRatePercent: currentRate,
    secondaryRatePercent: newRate,
    resultPayment: result.newInstallment,
    resultTotal: result.newTotal,
    resultInterest: result.currentTotal - result.remainingPrincipal,
    resultSavings: result.savings,
  },
  attributes: {
    commissionIncluded: mode === 'payoff' ? commissionIncluded : false,
    compensationRatePercent: result.compensationRatePercent,
  },
});

export const buildCommercialAnalyticsEvent = (result: CommercialResult): CalculationEventInput => {
  let principalAmount: number;
  let primaryRatePercent: number;
  let termValue: number;
  let attributes: Record<string, boolean | number | string> = {};
  switch (result.productType) {
    case 'commercial_installment':
      principalAmount = result.input.principal; primaryRatePercent = result.input.monthlyInterestRatePercent;
      termValue = result.input.termMonths; attributes = { paymentFrequencyMonths: result.input.paymentFrequencyMonths }; break;
    case 'commercial_spot':
      principalAmount = result.input.principal; primaryRatePercent = result.input.annualInterestRatePercent; termValue = result.dayCount; break;
    case 'commercial_revolving':
      principalAmount = result.input.principal ?? (() => {
        let balance = 0;
        let peakBalance = 0;
        const dailyNet = new Map<number, number>();
        for (const movement of result.input.movements ?? []) {
          const day = new Date(movement.date.getFullYear(), movement.date.getMonth(), movement.date.getDate()).getTime();
          dailyNet.set(day, (dailyNet.get(day) ?? 0) + movement.amount);
        }
        for (const [, amount] of [...dailyNet.entries()].sort(([a], [b]) => a - b)) {
          balance += amount;
          peakBalance = Math.max(peakBalance, balance);
        }
        return peakBalance;
      })();
      primaryRatePercent = result.input.annualInterestRatePercent;
      termValue = result.totalDays; attributes = { commercialMode: result.input.mode }; break;
    case 'commercial_discount':
      principalAmount = result.nominalAmount; primaryRatePercent = result.input.annualDiscountRatePercent;
      termValue = result.dayCount; attributes = { documentType: result.input.documentType }; break;
  }
  return {
    calculator: 'loan', variant: result.productType,
    metrics: {
      principalAmount, primaryRatePercent,
      termValue,
      taxRate1Percent: result.input.kkdfRatePercent, taxRate2Percent: result.input.bsmvRatePercent,
      resultPayment: result.productType === 'commercial_installment' ? result.firstInstallment : 0,
      resultTotal: result.productType === 'commercial_installment' ? result.totalRepayment
        : result.productType === 'commercial_spot' ? result.maturityPayment
          : result.productType === 'commercial_discount' ? result.netProceeds
            : Math.max(principalAmount, result.closingBalance + result.totalFinancingCost),
      resultInterest: result.interest,
      resultNetReturn: result.productType === 'commercial_discount' ? result.netProceeds : undefined,
    },
    attributes,
  };
};
