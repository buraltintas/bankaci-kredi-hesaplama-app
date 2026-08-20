import { calculateDeposit } from '../calculateDeposit';
import { buildDepositShareMessage } from '../shareSummary';

describe('buildDepositShareMessage', () => {
  const result = calculateDeposit({
    principal: 500000,
    annualInterestRatePercent: 46,
    termDays: 32,
    withholdingTaxRatePercent: 17.5,
    startDate: new Date(2026, 7, 20),
  });

  const message = buildDepositShareMessage(result);

  it('leads with what the customer actually receives', () => {
    expect(message).toContain('Vade sonu toplam: 516.635,61 TL');
  });

  it('shows the tax as a deduction rather than a bare figure', () => {
    expect(message).toContain('Stopaj (%17,5): -3.528,77 TL');
  });

  it('carries the terms someone would need to reproduce the calculation', () => {
    expect(message).toContain('Anapara: 500.000,00 TL');
    expect(message).toContain('Vade: 32 gün');
    expect(message).toContain('Yıllık brüt faiz oranı: %46');
    expect(message).toContain('Vade sonu tarihi: 21.09.2026');
  });
});
