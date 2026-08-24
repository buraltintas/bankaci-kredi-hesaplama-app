import type { LoanPlanType } from '../domain/loan/types';

/**
 * Loan plan types reserved for premium. Standard fixed-installment stays free;
 * every advanced plan sits behind the entitlement. The gate is UI-level, but a
 * calculation cannot be produced without passing through it (see the calculate
 * and recent-open handlers), so a free user never receives a premium result.
 */
export const PREMIUM_PLAN_TYPES: ReadonlySet<LoanPlanType> = new Set<LoanPlanType>(
  [
    'prepaidInterest',
    'equalPrincipal',
    'customPayment',
    'interestOnly',
    'increasingInstallment',
    'decreasingInstallment',
  ]
);

export const isPremiumPlanType = (
  planType: LoanPlanType | string | undefined
): boolean => {
  return planType !== undefined && PREMIUM_PLAN_TYPES.has(planType as LoanPlanType);
};

/**
 * Whether the person may use the given plan type right now. Premium holders may
 * use everything; everyone else is limited to the free plans.
 */
export const canUsePlanType = (
  planType: LoanPlanType | string | undefined,
  isPremium: boolean
): boolean => {
  return isPremium || !isPremiumPlanType(planType);
};

/** PDF export is premium regardless of plan type. */
export const canExportPdf = (isPremium: boolean): boolean => isPremium;

/** Housing-loan transfer calculations are available to premium holders only. */
export const canUseTransfer = (isPremium: boolean): boolean => isPremium;
