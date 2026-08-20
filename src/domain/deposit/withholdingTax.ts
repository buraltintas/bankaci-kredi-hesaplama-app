/**
 * Withholding-tax brackets for TL time deposits, by maturity.
 *
 * These rates are set by decree and change from time to time, so they are
 * defaults rather than fixed truth: the screen pre-fills the matching bracket
 * and the user can overwrite it. Update this table when the decree changes —
 * it is the only place the rates live.
 */
export type WithholdingTaxBracket = {
  /** Bracket applies while the term is at most this many days. */
  maxTermDays: number;
  ratePercent: number;
  label: string;
};

export const WITHHOLDING_TAX_BRACKETS: WithholdingTaxBracket[] = [
  { maxTermDays: 180, ratePercent: 17.5, label: '6 aya kadar' },
  { maxTermDays: 365, ratePercent: 15, label: '6 ay - 1 yıl' },
  { maxTermDays: Number.POSITIVE_INFINITY, ratePercent: 10, label: '1 yıldan uzun' },
];

export const suggestWithholdingTaxRate = (termDays: number): number => {
  if (!Number.isFinite(termDays) || termDays <= 0) {
    return WITHHOLDING_TAX_BRACKETS[0].ratePercent;
  }

  const bracket = WITHHOLDING_TAX_BRACKETS.find(
    (candidate) => termDays <= candidate.maxTermDays
  );

  return bracket?.ratePercent ?? WITHHOLDING_TAX_BRACKETS[0].ratePercent;
};

export const describeWithholdingTaxBracket = (termDays: number): string => {
  const bracket = WITHHOLDING_TAX_BRACKETS.find(
    (candidate) => termDays <= candidate.maxTermDays
  );

  return bracket?.label ?? WITHHOLDING_TAX_BRACKETS[0].label;
};
