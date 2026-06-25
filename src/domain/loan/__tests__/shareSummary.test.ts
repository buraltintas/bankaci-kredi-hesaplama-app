import { calculateLoan } from '../calculateLoan';
import { buildLoanShareMessage } from '../shareSummary';

describe('buildLoanShareMessage', () => {
  it('renders custom payment summary row by row', () => {
    const result = calculateLoan({
      principal: 120000,
      term: 12,
      monthlyInterestRatePercent: 3,
      kkdfRatePercent: 0,
      bsmvRatePercent: 0,
      creditUsageDate: new Date(2026, 5, 24),
      firstInstallmentDate: new Date(2026, 6, 24),
      planType: 'customPayment',
      customPayments: [
        { installmentNo: 1, amount: 10000 },
        { installmentNo: 10, amount: 50000 },
      ],
    });
    const message = buildLoanShareMessage(result);

    expect(message).toContain('Plan Tipi: Özel / Balon Ödeme Planı');
    expect(message).toContain('Otomatik taksit');
    expect(message).toContain('Özel ödeme sayısı: 2');
    expect(message).toContain('Özel Ödemeler:');
    expect(message).toContain('1. taksit: 10.000,00 TL');
    expect(message).toContain('10. taksit: 50.000,00 TL');
    expect(message).not.toContain('Standart aylık taksit');
  });
});
