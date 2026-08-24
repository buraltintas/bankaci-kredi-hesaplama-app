import { buildTransferShareMessage } from '../shareSummary';
import type { TransferComparison } from '../types';

const buildResult = (savings: number): TransferComparison => ({
  remainingPrincipal: 1_000_000,
  compensation: 20_000,
  compensationRatePercent: 2,
  refinancePrincipal: 1_020_000,
  currentInstallment: 35_000,
  currentTotal: 2_100_000,
  newInstallment: 30_000,
  newTotal: 1_800_000,
  savings,
  remainingTerm: 60,
});

describe('buildTransferShareMessage', () => {
  it('shares a saving with the comparison details', () => {
    const message = buildTransferShareMessage(buildResult(300_000));

    expect(message).toContain('Tahmini kazanç: 300.000,00 TL');
    expect(message).toContain('Kalan anapara (yaklaşık): 1.000.000,00 TL');
    expect(message).toContain('Erken ödeme tazminatı (%2): 20.000,00 TL');
    expect(message).toContain('Mevcut taksit: 35.000,00 TL');
    expect(message).toContain('Yeni taksit: 30.000,00 TL');
    expect(message).toContain('Kalan vade: 60 ay');
  });

  it('labels a negative saving as an additional cost without a double sign', () => {
    const message = buildTransferShareMessage(buildResult(-125_000));

    expect(message).toContain('Tahmini ek maliyet: 125.000,00 TL');
    expect(message).not.toContain('Tahmini ek maliyet: -');
  });
});
