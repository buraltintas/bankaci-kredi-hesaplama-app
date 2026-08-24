export type TransferComparison = {
  /** Approximate principal still owed on the current loan. */
  remainingPrincipal: number;
  /** Early-repayment compensation charged to close the current loan. */
  compensation: number;
  compensationRatePercent: number;
  /** New loan needed to pay off the old one, compensation included. */
  refinancePrincipal: number;
  /** Monthly payment on the current loan over the remaining term. */
  currentInstallment: number;
  /** Total still payable on the current loan if left untouched. */
  currentTotal: number;
  /** Monthly payment on the refinanced loan. */
  newInstallment: number;
  /** Total payable on the refinanced loan over the same remaining term. */
  newTotal: number;
  /** currentTotal - newTotal. Positive is a saving, negative a loss. */
  savings: number;
  remainingTerm: number;
};

export type TransferFromPayoffInput = {
  payoffAmount: number;
  /** Whether the payoff amount already includes the compensation. */
  commissionIncluded: boolean;
  compensationRatePercent: number;
  currentMonthlyRatePercent: number;
  newMonthlyRatePercent: number;
  remainingTerm: number;
};

export type TransferFromEstimateInput = {
  originalPrincipal: number;
  originalTerm: number;
  remainingInstallments: number;
  compensationRatePercent: number;
  currentMonthlyRatePercent: number;
  newMonthlyRatePercent: number;
};
