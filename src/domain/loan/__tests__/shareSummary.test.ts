import { calculateLoan as calculateLoanEngine } from '../calculateLoan';
import { buildLoanShareMessage } from '../shareSummary';
import type { LoanInput } from '../types';

const calculateLoan = (input: LoanInput) =>
  calculateLoanEngine({
    deductFirstInstallmentDelayFromTerm: false,
    ...input,
  });

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
        { installmentNo: 12, amount: 50000 },
      ],
    });
    const message = buildLoanShareMessage(result);

    expect(message).toContain('Plan Tipi: Özel / Balon Ödeme Planı');
    expect(message).toContain('Otomatik taksit');
    expect(message).toContain('Özel ödeme sayısı: 2');
    expect(message).toContain('Özel Ödemeler:');
    expect(message).toContain('1. taksit: 10.000,00 TL');
    expect(message).toContain('12. taksit: 50.000,00 TL');
    expect(message).not.toContain('Standart aylık taksit');
  });

  it('renders interest-only summary without standard monthly installment wording', () => {
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
    const message = buildLoanShareMessage(result);

    expect(message).toContain('Plan Tipi: Anapara Ödemesiz Dönemli Plan');
    expect(message).toContain('Anapara ödemesiz taksit sayısı: 3');
    expect(message).toContain('Anapara ödemesiz dönem taksiti');
    expect(message).toContain('Sonraki dönem taksiti');
    expect(message).toContain('Toplam ödeme');
    expect(message).not.toContain('Standart aylık taksit');
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
    const message = buildLoanShareMessage(result);

    expect(result.schedule).toHaveLength(11);
    expect(message).toContain('Girilen vade: 12 ay');
    expect(message).toContain('Ödeme planı taksit sayısı: 11');
    expect(message).toContain(
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
    const message = buildLoanShareMessage(result);

    expect(result.schedule).toHaveLength(12);
    expect(message).not.toContain('Ödeme planı taksit sayısı');
    expect(message).not.toContain('toplam vade aşılmaması');
  });

  it('renders first installment delay deduction info when enabled', () => {
    const result = calculateLoanEngine({
      principal: 100000,
      term: 24,
      monthlyInterestRatePercent: 3,
      kkdfRatePercent: 0,
      bsmvRatePercent: 0,
      creditUsageDate: new Date(2026, 5, 25),
      firstInstallmentDate: new Date(2026, 8, 25),
      deductFirstInstallmentDelayFromTerm: true,
      planType: 'standard',
    });
    const message = buildLoanShareMessage(result);

    expect(message).toContain('Girilen vade: 24 ay');
    expect(message).toContain('İlk taksit ertelemesi: 2 ay');
    expect(message).toContain('Ödeme planı taksit sayısı: 22');
  });

  it('renders increasing installment summary without standard monthly installment wording', () => {
    const result = calculateLoan({
      principal: 100000,
      term: 12,
      monthlyInterestRatePercent: 2,
      kkdfRatePercent: 0,
      bsmvRatePercent: 0,
      creditUsageDate: new Date(2026, 5, 24),
      firstInstallmentDate: new Date(2026, 6, 24),
      planType: 'increasingInstallment',
      installmentIncreaseRatePercent: 5,
      installmentIncreaseFrequencyMonths: 12,
      installmentIncreaseStartNo: 1,
      installmentIncreaseEndNo: 12,
    });
    const message = buildLoanShareMessage(result);

    expect(message).toContain('Plan Tipi: Artan Taksitli Plan');
    expect(message).toContain('Taksit artış oranı: %5');
    expect(message).toContain('Artış sıklığı: 12 ay');
    expect(message).toContain('Artış başlangıç taksiti: 1. taksit');
    expect(message).toContain('Artış bitiş taksiti: 12. taksit');
    expect(message).toContain('İlk taksit');
    expect(message).toContain('Son taksit');
    expect(message).toContain('Toplam ödeme');
    expect(message).not.toContain('Standart aylık taksit');
  });
});
