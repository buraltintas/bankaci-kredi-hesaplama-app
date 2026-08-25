import {
  canExportPdf,
  canCreateFeedPost,
  canUseBankCampaigns,
  canUseLeadForm,
  canUsePlanType,
  canUseTransfer,
  canUseWidget,
  isPremiumPlanType,
} from '../premiumFeatures';

describe('premium feature gating', () => {
  it('leaves standard fixed-installment free', () => {
    expect(isPremiumPlanType('standard')).toBe(false);
    expect(canUsePlanType('standard', false)).toBe(true);
  });

  it('reserves every advanced plan for premium', () => {
    for (const planType of [
      'prepaidInterest',
      'equalPrincipal',
      'customPayment',
      'interestOnly',
      'increasingInstallment',
      'decreasingInstallment',
    ]) {
      expect(isPremiumPlanType(planType)).toBe(true);
      expect(canUsePlanType(planType, false)).toBe(false);
      expect(canUsePlanType(planType, true)).toBe(true);
    }
  });

  it('treats an unknown or missing plan type as free', () => {
    expect(isPremiumPlanType(undefined)).toBe(false);
    expect(isPremiumPlanType('somethingElse')).toBe(false);
  });

  it('locks PDF export to premium', () => {
    expect(canExportPdf(false)).toBe(false);
    expect(canExportPdf(true)).toBe(true);
  });

  it('locks housing-loan transfer calculations to premium', () => {
    expect(canUseTransfer(false)).toBe(false);
    expect(canUseTransfer(true)).toBe(true);
  });

  it('reserves the new banker tools for premium', () => {
    for (const gate of [
      canCreateFeedPost,
      canUseWidget,
      canUseLeadForm,
      canUseBankCampaigns,
    ]) {
      expect(gate(false)).toBe(false);
      expect(gate(true)).toBe(true);
    }
  });
});
