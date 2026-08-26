export type CommercialProductType =
  | 'commercial_installment'
  | 'commercial_spot'
  | 'commercial_revolving'
  | 'commercial_discount';

export type CommercialTaxConfig = {
  bsmvRatePercent: number;
  kkdfRatePercent: number;
  otherTaxRatePercent: number;
};

export type CommercialMoneyBreakdown = {
  interest: number;
  bsmv: number;
  kkdf: number;
  otherTax: number;
  totalFinancingCost: number;
};

export type CommercialInstallmentInput = CommercialTaxConfig & {
  productType: 'commercial_installment';
  principal: number;
  monthlyInterestRatePercent: number;
  creditUsageDate: Date;
  firstInstallmentDate: Date;
  termMonths: number;
  paymentFrequencyMonths: 1 | 3 | 6;
};

export type CommercialInstallmentScheduleItem = CommercialMoneyBreakdown & {
  installmentNumber: number;
  date: Date;
  installment: number;
  principal: number;
  remainingPrincipal: number;
};

export type CommercialInstallmentResult = CommercialMoneyBreakdown & {
  productType: 'commercial_installment';
  input: CommercialInstallmentInput;
  installmentCount: number;
  regularInstallment: number;
  firstInstallment: number;
  totalRepayment: number;
  schedule: CommercialInstallmentScheduleItem[];
  dayCountConvention: 'contractual-month/ACT-360-broken-period';
  brokenPeriodDays: number;
};

export type CommercialSpotInput = CommercialTaxConfig & {
  productType: 'commercial_spot';
  principal: number;
  annualInterestRatePercent: number;
  creditUsageDate: Date;
  maturityDate: Date;
};

export type CommercialSpotResult = CommercialMoneyBreakdown & {
  productType: 'commercial_spot';
  input: CommercialSpotInput;
  dayCount: number;
  maturityPayment: number;
  dayCountConvention: 'ACT/360';
};

export type RevolvingMovement = {
  id?: string;
  date: Date;
  amount: number;
};

export type CommercialRevolvingInput = CommercialTaxConfig & {
  productType: 'commercial_revolving';
  mode: 'simple' | 'movements';
  annualInterestRatePercent: number;
  startDate: Date;
  endDate: Date;
  principal?: number;
  movements?: RevolvingMovement[];
};

export type RevolvingPeriod = {
  startDate: Date;
  endDate: Date;
  openingBalance: number;
  dayCount: number;
  interest: number;
};

export type CommercialRevolvingResult = CommercialMoneyBreakdown & {
  productType: 'commercial_revolving';
  input: CommercialRevolvingInput;
  totalDays: number;
  closingBalance: number;
  periods: RevolvingPeriod[];
  dayCountConvention: 'ACT/360';
};

export type CommercialDiscountInput = CommercialTaxConfig & {
  productType: 'commercial_discount';
  documentType: 'cheque' | 'promissory_note';
  nominalAmount: number;
  transactionDate: Date;
  maturityDate: Date;
  annualDiscountRatePercent: number;
  /** TCMB reeskont method includes the discount/transaction day. */
  includeTransactionDay?: boolean;
};

export type CommercialDiscountResult = CommercialMoneyBreakdown & {
  productType: 'commercial_discount';
  input: CommercialDiscountInput;
  dayCount: number;
  nominalAmount: number;
  totalDeduction: number;
  netProceeds: number;
  dayCountConvention: 'ACT/360';
};

export type CommercialInput =
  | CommercialInstallmentInput
  | CommercialSpotInput
  | CommercialRevolvingInput
  | CommercialDiscountInput;

export type CommercialResult =
  | CommercialInstallmentResult
  | CommercialSpotResult
  | CommercialRevolvingResult
  | CommercialDiscountResult;

export const COMMERCIAL_PRODUCT_LABELS: Record<CommercialProductType, string> = {
  commercial_installment: 'Taksitli Ticari Kredi',
  commercial_spot: 'Spot Kredi',
  commercial_revolving: 'Rotatif / BCH',
  commercial_discount: 'Çek / Senet İskonto',
};
