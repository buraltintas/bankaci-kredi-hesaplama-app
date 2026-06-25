import { calculateLoan } from '../../domain/loan/calculateLoan';
import { createLoanPdfHtml } from '../createLoanPdfHtml';

const formatCurrency = (value: number) =>
  value.toLocaleString('tr-TR', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });

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

  it('renders prepaid interest plan details and the upfront row', () => {
    const result = calculateLoan({
      principal: 1000000,
      term: 36,
      monthlyInterestRatePercent: 3.1,
      kkdfRatePercent: 0,
      bsmvRatePercent: 0,
      creditUsageDate: new Date(2026, 5, 24),
      firstInstallmentDate: new Date(2026, 6, 24),
      planType: 'prepaidInterest',
      prepaidInterestAmount: 50000,
    });
    const html = createLoanPdfHtml(result);

    expect(html).toContain('Ödeme Planı Tipi');
    expect(html).toContain('Peşin Faiz Ödemeli');
    expect(html).toContain('İndirimli faiz oranı');
    expect(html).toContain('%2,759');
    expect(html).toContain('0. taksit peşin faiz');
    expect(html).toContain('<td>0</td>');
    expect(html).toContain('49.862');
  });

  it('renders prepaid interest totals from the result model', () => {
    const result = calculateLoan({
      principal: 500000,
      term: 24,
      monthlyInterestRatePercent: 4.2,
      kkdfRatePercent: 15,
      bsmvRatePercent: 15,
      creditUsageDate: new Date(2026, 5, 24),
      firstInstallmentDate: new Date(2026, 6, 24),
      planType: 'prepaidInterest',
      prepaidInterestAmount: 25000,
    });
    const html = createLoanPdfHtml(result);

    expect(result.schedule[0].kkdf).toBeCloseTo(3744.09, 2);
    expect(result.schedule[0].bsmv).toBeCloseTo(3744.09, 2);
    expect(html).toContain(formatCurrency(result.totalPayment));
    expect(html).toContain('Toplam faiz / KKDF / BSMV');
    expect(html).toContain(formatCurrency(result.totalKkdf));
    expect(html).toContain(formatCurrency(result.totalBsmv));
  });

  it('renders equal principal plan details', () => {
    const result = calculateLoan({
      principal: 120000,
      term: 12,
      monthlyInterestRatePercent: 3,
      kkdfRatePercent: 15,
      bsmvRatePercent: 15,
      creditUsageDate: new Date(2026, 5, 24),
      firstInstallmentDate: new Date(2026, 6, 24),
      planType: 'equalPrincipal',
    });
    const html = createLoanPdfHtml(result);

    expect(html).toContain('Ödeme Planı Tipi');
    expect(html).toContain('Eşit Anapara Ödemeli');
    expect(html).toContain('Aylık anapara');
    expect(html).toContain(formatCurrency(result.monthlyPrincipalAmount ?? 0));
    expect(html).toContain('Son taksit tutarı');
    expect(html).toContain(formatCurrency(result.lastInstallmentAmount ?? 0));
    expect(html).toContain(formatCurrency(result.totalPayment));
  });

  it('renders custom payment plan details and individual custom payments', () => {
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
    const html = createLoanPdfHtml(result);

    expect(html).toContain('Özel / Balon Ödeme Planı');
    expect(html).toContain('Otomatik taksit');
    expect(html).toContain(formatCurrency(result.automaticInstallmentAmount ?? 0));
    expect(html).toContain('Özel ödeme sayısı');
    expect(html).toContain('Özel Ödemeler:');
    expect(html).toContain('1. taksit: 10.000,00 TL');
    expect(html).toContain('10. taksit: 50.000,00 TL');
  });

  it('renders interest-only plan details and labels interest-only rows', () => {
    const result = calculateLoan({
      principal: 120000,
      term: 12,
      monthlyInterestRatePercent: 3,
      kkdfRatePercent: 15,
      bsmvRatePercent: 15,
      creditUsageDate: new Date(2026, 5, 24),
      firstInstallmentDate: new Date(2026, 6, 24),
      planType: 'interestOnly',
      interestOnlyInstallmentCount: 3,
    });
    const html = createLoanPdfHtml(result);

    expect(html).toContain('Anapara Ödemesiz Dönemli Plan');
    expect(html).toContain('Anapara Ödemesiz Taksit Sayısı');
    expect(html).toContain('Anapara Ödemesiz Dönem Taksiti');
    expect(html).toContain('Sonraki Dönem Taksiti');
    expect(html).toContain(formatCurrency(result.postInterestOnlyInstallmentAmount ?? 0));
    expect(html).toContain('Anapara Ödemesiz');
    expect(html).toContain(formatCurrency(result.totalPayment));
  });

  it('renders effective installment info for shortened interest-only schedules', () => {
    const result = calculateLoan({
      principal: 250000,
      term: 12,
      monthlyInterestRatePercent: 4.3,
      kkdfRatePercent: 15,
      bsmvRatePercent: 15,
      creditUsageDate: new Date(2026, 5, 25),
      firstInstallmentDate: new Date(2026, 7, 1),
      planType: 'interestOnly',
      interestOnlyInstallmentCount: 6,
    });
    const html = createLoanPdfHtml(result);

    expect(result.schedule).toHaveLength(11);
    expect(html).toContain('Taksit sayısı bilgilendirmesi');
    expect(html).toContain('Girilen vade: 12 ay');
    expect(html).toContain('Ödeme planı taksit sayısı: 11');
    expect(html).toContain(
      'İlk taksit tarihi nedeniyle toplam vade aşılmaması için taksit sayısı 11 olarak hesaplandı.'
    );
  });

  it('does not render effective installment info for standard plans', () => {
    const result = calculateLoan({
      principal: 250000,
      term: 12,
      monthlyInterestRatePercent: 4.3,
      kkdfRatePercent: 15,
      bsmvRatePercent: 15,
      creditUsageDate: new Date(2026, 5, 25),
      firstInstallmentDate: new Date(2026, 7, 1),
      planType: 'standard',
    });
    const html = createLoanPdfHtml(result);

    expect(result.schedule).toHaveLength(12);
    expect(html).not.toContain('Taksit sayısı bilgilendirmesi');
    expect(html).not.toContain('Ödeme planı taksit sayısı');
    expect(html).not.toContain('toplam vade aşılmaması');
  });

  it('renders increasing installment plan details without standard installment wording', () => {
    const result = calculateLoan({
      principal: 100000,
      term: 24,
      monthlyInterestRatePercent: 2,
      kkdfRatePercent: 0,
      bsmvRatePercent: 0,
      creditUsageDate: new Date(2026, 5, 24),
      firstInstallmentDate: new Date(2026, 6, 24),
      planType: 'increasingInstallment',
      installmentIncreaseRatePercent: 5,
      installmentIncreaseFrequencyMonths: 12,
    });
    const html = createLoanPdfHtml(result);

    expect(html).toContain('Artan Taksitli Plan');
    expect(html).toContain('Taksit Artış Oranı');
    expect(html).toContain('%5');
    expect(html).toContain('Artış Sıklığı');
    expect(html).toContain('12 ay');
    expect(html).toContain('İlk Taksit');
    expect(html).toContain(formatCurrency(result.firstInstallmentAmount ?? 0));
    expect(html).toContain('İlk Artış Sonrası Taksit');
    expect(html).toContain(formatCurrency(result.schedule[12].installment));
    expect(html).not.toContain('İlk taksit tutarı');
    expect(html).toContain('Son Taksit');
    expect(html).toContain(formatCurrency(result.lastInstallmentAmount ?? 0));
    expect(html).toContain(formatCurrency(result.totalPayment));
    expect(html).not.toContain('Standart aylık taksit');
  });
});
