export type CalculatorType = 'loan' | 'deposit' | 'transfer';

export type CalculationMetrics = {
  principalAmount?: number;
  termValue?: number;
  primaryRatePercent?: number;
  secondaryRatePercent?: number;
  taxRate1Percent?: number;
  taxRate2Percent?: number;
  resultPayment?: number;
  resultTotal?: number;
  resultInterest?: number;
  resultNetReturn?: number;
  resultSavings?: number;
};

export type CalculationEventInput = {
  calculator: CalculatorType;
  variant: string;
  metrics: CalculationMetrics;
  attributes?: Record<string, boolean | number | string>;
};

export type QueuedCalculationEvent = CalculationEventInput & {
  eventId: string;
  installationId: string;
  occurredAt: string;
  appVersion: string;
  platform: 'ios' | 'android';
};
