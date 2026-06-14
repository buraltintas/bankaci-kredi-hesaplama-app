export type LoanInput = {
  principal: number;
  term: number;
  monthlyInterestRatePercent: number;
  kkdfRatePercent: number;
  bsmvRatePercent: number;
  creditUsageDate: Date;
  firstInstallmentDate: Date;
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
  standardInstallment: number;
  firstInstallment: number;
  totalPayment: number;
  totalPrincipal: number;
  totalInterest: number;
  totalKkdf: number;
  totalBsmv: number;
  schedule: PaymentScheduleItem[];
  brokenPeriod: BrokenPeriodInfo;
};
