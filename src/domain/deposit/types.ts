export type DepositInput = {
  /** Yatırılan anapara. */
  principal: number;
  /** Yıllık brüt faiz oranı (%). */
  annualInterestRatePercent: number;
  /** Vade, gün cinsinden. */
  termDays: number;
  /** Faiz gelirine uygulanan stopaj oranı (%). */
  withholdingTaxRatePercent: number;
  /** Hesabın açıldığı tarih. */
  startDate: Date;
};

export type DepositCalculationResult = {
  principal: number;
  termDays: number;
  annualInterestRatePercent: number;
  withholdingTaxRatePercent: number;
  /** Stopaj öncesi faiz. */
  grossInterest: number;
  /** Kesilen stopaj tutarı. */
  withholdingTax: number;
  /** Stopaj sonrası, hesaba geçen faiz. */
  netInterest: number;
  /** Vade sonunda eline geçen toplam: anapara + net faiz. */
  maturityAmount: number;
  maturityDate: Date;
  /** Net getirinin yıllık orana çevrilmiş hâli (%). */
  effectiveAnnualNetRatePercent: number;
};
