import { calculateLoan } from '../../domain/loan/calculateLoan';
import type { LoanInput } from '../../domain/loan/types';
import { getPaymentPlanRecommendations } from '../paymentPlanRecommendationEngine';

const baseInput: LoanInput = {
  principal: 100000,
  term: 24,
  monthlyInterestRatePercent: 2,
  kkdfRatePercent: 0,
  bsmvRatePercent: 0,
  creditUsageDate: new Date('2026-07-01T00:00:00.000Z'),
  firstInstallmentDate: new Date('2026-08-01T00:00:00.000Z'),
  deductFirstInstallmentDelayFromTerm: true,
};

describe('paymentPlanRecommendationEngine', () => {
  it('returns rule-based alternatives calculated through the loan engine', () => {
    const baseline = calculateLoan({
      ...baseInput,
      planType: 'standard',
    });
    const recommendations = getPaymentPlanRecommendations(baseline);

    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations.length).toBeLessThanOrEqual(3);
    expect(recommendations.map((item) => item.planType)).not.toContain('standard');
    expect(recommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          planType: 'equalPrincipal',
          impact: 'lowerTotalPayment',
        }),
        expect.objectContaining({
          planType: 'increasingInstallment',
          impact: 'lowerInitialInstallment',
        }),
      ])
    );
    const increasingRecommendation = recommendations.find(
      (item) => item.planType === 'increasingInstallment'
    );

    expect(increasingRecommendation?.details.join(' ')).toContain(
      'Artış varsayımı: %5, 12 ayda bir, 1-24. taksit aralığında.'
    );
  });

  it('compares alternatives against the active non-standard baseline', () => {
    const baseline = calculateLoan({
      ...baseInput,
      planType: 'equalPrincipal',
    });
    const recommendations = getPaymentPlanRecommendations(baseline);

    expect(recommendations.map((item) => item.planType)).toContain('standard');
    expect(recommendations.map((item) => item.planType)).not.toContain(
      'equalPrincipal'
    );
    expect(
      recommendations.find((item) => item.planType === 'standard')?.message
    ).toContain('daha dengeli');
  });

  it('does not throw when a candidate cannot be meaningfully calculated', () => {
    const baseline = calculateLoan({
      ...baseInput,
      term: 1,
      planType: 'standard',
    });

    expect(() => getPaymentPlanRecommendations(baseline)).not.toThrow();
    expect(
      getPaymentPlanRecommendations(baseline).map((item) => item.planType)
    ).not.toContain('increasingInstallment');
  });

  it('includes rate, frequency and range assumptions for decreasing alternatives', () => {
    const baseline = calculateLoan({
      ...baseInput,
      planType: 'standard',
    });
    const decreasingRecommendation = getPaymentPlanRecommendations(baseline).find(
      (item) => item.planType === 'decreasingInstallment'
    );

    expect(decreasingRecommendation?.details.join(' ')).toContain(
      'Azalış varsayımı: %5, 12 ayda bir, 1-24. taksit aralığında.'
    );
  });

  it('uses the same credit, tax and date inputs for recommended alternatives', () => {
    const baseline = calculateLoan({
      ...baseInput,
      kkdfRatePercent: 15,
      bsmvRatePercent: 15,
      firstInstallmentDate: new Date('2026-09-05T00:00:00.000Z'),
      planType: 'standard',
    });
    const recommendations = getPaymentPlanRecommendations(baseline);

    recommendations.forEach((recommendation) => {
      expect(Number.isFinite(recommendation.comparison.totalPaymentDifference)).toBe(
        true
      );
      expect(recommendation.details.join(' ')).toContain('mevcut');
    });
  });
});
