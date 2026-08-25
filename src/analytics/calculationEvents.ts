import type { DepositCalculationResult } from '../domain/deposit/types';
import type {
  LoanCalculationResult,
  LoanInput,
} from '../domain/loan/types';
import type { TransferComparison } from '../domain/transfer/types';
import type { CalculationEventInput } from './types';

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
