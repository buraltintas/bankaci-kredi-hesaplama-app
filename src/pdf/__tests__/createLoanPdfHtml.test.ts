import { calculateLoan } from '../../domain/loan/calculateLoan';
import { createLoanPdfHtml } from '../createLoanPdfHtml';

describe('createLoanPdfHtml', () => {
  it('renders summary, table and broken period note', () => {
    const result = calculateLoan({
      principal: 100000,
      term: 12,
      monthlyInterestRatePercent: 3,
      kkdfRatePercent: 15,
      bsmvRatePercent: 15,
      creditUsageDate: new Date(2026, 5, 1),
      firstInstallmentDate: new Date(2026, 6, 15),
    });
    const html = createLoanPdfHtml(result);

    expect(html).toContain('Kredi Ödeme Planı');
    expect(html).not.toContain('Bankacı Kredi Hesaplama');
    expect(html).toContain('Kırık dönem farkı sadece 1. taksite');
    expect(html).toContain('<table>');
    expect(html).toContain('100.000,00');
  });

  it('renders optional contact information safely', () => {
    const result = calculateLoan({
      principal: 100000,
      term: 12,
      monthlyInterestRatePercent: 3,
      kkdfRatePercent: 15,
      bsmvRatePercent: 15,
      creditUsageDate: new Date(2026, 5, 1),
      firstInstallmentDate: new Date(2026, 6, 1),
    });
    const html = createLoanPdfHtml(result, {
      fullName: 'Ayşe <Yılmaz>',
      phone: '0555 111 22 33',
    });

    expect(html).toContain('İletişim Bilgileri');
    expect(html).toContain('Ayşe &lt;Yılmaz&gt;');
    expect(html).toContain('0555 111 22 33');
  });
});
