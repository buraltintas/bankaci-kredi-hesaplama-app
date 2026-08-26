import { calculateCommercialDiscount } from './calculateDiscount';
import { calculateCommercialInstallment } from './calculateInstallment';
import { calculateCommercialRevolving } from './calculateRevolving';
import { calculateCommercialSpot } from './calculateSpot';
import { buildCommercialShareMessage } from './shareSummary';
import { createCommercialPdfHtml } from '../../pdf/createCommercialPdfHtml';

const d = (day: number) => new Date(2026, 0, day);
const tax = { bsmvRatePercent: 5, kkdfRatePercent: 0, otherTaxRatePercent: 0 };

describe('commercial share and PDF outputs', () => {
  const results = [
    calculateCommercialInstallment({ productType: 'commercial_installment', principal: 100000, monthlyInterestRatePercent: 3, termMonths: 3, paymentFrequencyMonths: 1, creditUsageDate: d(1), firstInstallmentDate: new Date(2026, 1, 1), ...tax }),
    calculateCommercialSpot({ productType: 'commercial_spot', principal: 100000, annualInterestRatePercent: 36, creditUsageDate: d(1), maturityDate: d(31), ...tax }),
    calculateCommercialRevolving({ productType: 'commercial_revolving', mode: 'simple', principal: 100000, annualInterestRatePercent: 36, startDate: d(1), endDate: d(31), ...tax }),
    calculateCommercialDiscount({ productType: 'commercial_discount', documentType: 'cheque', nominalAmount: 100000, annualDiscountRatePercent: 36, transactionDate: d(1), maturityDate: d(31), ...tax }),
  ];

  it.each(results)('renders complete, finite output for $productType', (result) => {
    const share = buildCommercialShareMessage(result);
    const pdf = createCommercialPdfHtml(result);
    expect(share).not.toMatch(/undefined|NaN|Infinity/);
    expect(pdf).not.toMatch(/undefined|NaN|Infinity/);
    expect(share).toContain('Toplam finansman maliyeti');
    expect(pdf).toContain('Toplam finansman maliyeti');
    expect(pdf).toContain('<!doctype html>');
    expect(share).not.toMatch(/ACT\/360|Gün hesabı|Faize esas gün|\(\d+ gün\)/);
    expect(pdf).not.toMatch(/ACT\/360|contractual-month|Gün hesabı|Faize esas gün/);
  });

  it('includes revolving movements in share and PDF outputs', () => {
    const result = calculateCommercialRevolving({
      productType: 'commercial_revolving',
      mode: 'movements',
      annualInterestRatePercent: 36,
      startDate: d(1),
      endDate: d(31),
      movements: [
        { date: d(1), amount: 100000 },
        { date: d(15), amount: -25000 },
      ],
      ...tax,
    });

    const share = buildCommercialShareMessage(result);
    const pdf = createCommercialPdfHtml(result);

    expect(share).toContain('Hesaplama biçimi: Hareketli hesap');
    expect(share).toContain('Hesap hareketleri:');
    expect(share).toContain('Kullanım');
    expect(share).toContain('Geri ödeme');
    expect(pdf).toContain('<h2>Hesap hareketleri</h2>');
    expect(pdf).toContain('Kullanım');
    expect(pdf).toContain('Geri ödeme');
  });

  it('renders optional banker contact information safely in commercial PDFs', () => {
    const pdf = createCommercialPdfHtml(results[0], {
      fullName: 'Burak <Altıntaş>',
      phone: '+90 555 111 22 33',
    });
    expect(pdf).toContain('İletişim Bilgileri');
    expect(pdf).toContain('Burak &lt;Altıntaş&gt;');
    expect(pdf).toContain('+90 555 111 22 33');
    expect(pdf).not.toContain('Burak <Altıntaş>');
  });
});
