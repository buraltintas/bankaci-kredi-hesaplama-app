export type LoanPlanType =
  | 'standard'
  | 'prepaidInterest'
  | 'equalPrincipal'
  | 'customPayment';

export type LoanInput = {
  principal: number;
  term: number;
  monthlyInterestRatePercent: number;
  kkdfRatePercent: number;
  bsmvRatePercent: number;
  creditUsageDate: Date;
  firstInstallmentDate: Date;
  planType?: LoanPlanType;
  prepaidInterestAmount?: number;
  customPayments?: Array<{
    installmentNo: number;
    amount: number;
  }>;
};

export type PaymentScheduleItem = {
  installmentNumber: number;
  date: Date;
  installment: number;
  principal: number;
  interest: number;
  kkdf: number;
  bsmv: number;
  remainingPrincipal: number;
  isPrepaidInterest?: boolean;
};

export type BrokenPeriodInfo = {
  standardFirstInstallmentDate: Date;
  actualFirstInstallmentDate: Date;
  diffDays: number;
  interestDiff: number;
  kkdfDiff: number;
  bsmvDiff: number;
  totalDiff: number;
};

export type LoanCalculationResult = {
  input: LoanInput;
  planType: LoanPlanType;
  standardInstallment: number;
  firstInstallment: number;
  totalPayment: number;
  totalPrincipal: number;
  totalInterest: number;
  totalKkdf: number;
  totalBsmv: number;
  schedule: PaymentScheduleItem[];
  brokenPeriod: BrokenPeriodInfo;
  discountedMonthlyRate?: number;
  prepaidInterestInput?: number;
  realizedPrepaidInterest?: number;
  monthlyPrincipalAmount?: number;
  firstInstallmentAmount?: number;
  lastInstallmentAmount?: number;
  automaticInstallmentAmount?: number;
  infoMessages?: string[];
  warnings?: string[];
};
