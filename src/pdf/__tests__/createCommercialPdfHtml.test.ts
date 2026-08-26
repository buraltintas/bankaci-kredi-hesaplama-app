import { calculateCommercialInstallment } from '../../domain/commercial/calculateInstallment';
import { createCommercialPdfHtml } from '../createCommercialPdfHtml';

describe('createCommercialPdfHtml', () => {
  it('renders the commercial summary and full payment schedule', () => {
    const result = calculateCommercialInstallment({
      productType: 'commercial_installment', principal: 100000,
      monthlyInterestRatePercent: 5, termMonths: 3, paymentFrequencyMonths: 1,
      creditUsageDate: new Date(2026, 0, 1), firstInstallmentDate: new Date(2026, 1, 1),
      bsmvRatePercent: 5, kkdfRatePercent: 0, otherTaxRatePercent: 0,
    });
    const html = createCommercialPdfHtml(result);
    expect(html).toContain('Taksitli Ticari Kredi');
    expect(html).toContain('Toplam geri ödeme');
    expect(html).toContain('Ödeme planı');
    expect(html).toContain('İşlem bilgileri');
    expect(html).toContain('Kullandırım / ilk taksit');
    expect(html.match(/<tr>/g)?.length).toBe(4);
    expect(html).toContain('finansal tavsiye değildir');
    expect(html).not.toContain('Gün hesabı');
    expect(html).not.toContain('ACT/360');
  });
});
