import { formatCurrency } from '../utils/formatCurrency';
import { formatDate } from '../utils/dateMath';
import { COMMERCIAL_PRODUCT_LABELS, type CommercialResult } from '../domain/commercial/types';

export type CommercialPdfContactInfo = {
  fullName: string;
  phone: string;
};

const esc = (value: unknown) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
const money = (value: number) => esc(formatCurrency(value));
const metric = (label: string, value: string | number) =>
  `<div class="metric">${esc(label)}<b>${typeof value === 'number' ? esc(value) : value}</b></div>`;

export const createCommercialPdfHtml = (
  result: CommercialResult,
  contactInfo?: CommercialPdfContactInfo
): string => {
  const inputDetails = (() => {
    switch (result.productType) {
      case 'commercial_installment':
        return [metric('Kredi tutarı', money(result.input.principal)), metric('Aylık faiz', `%${esc(result.input.monthlyInterestRatePercent)}`), metric('Vade / ödeme sıklığı', `${result.input.termMonths} ay / ${result.input.paymentFrequencyMonths} ayda bir`), metric('Kullandırım / ilk taksit', `${formatDate(result.input.creditUsageDate)} / ${formatDate(result.input.firstInstallmentDate)}`)];
      case 'commercial_spot':
        return [metric('Kredi tutarı', money(result.input.principal)), metric('Yıllık faiz', `%${esc(result.input.annualInterestRatePercent)}`), metric('Kullandırım / vade', `${formatDate(result.input.creditUsageDate)} / ${formatDate(result.input.maturityDate)}`)];
      case 'commercial_revolving':
        return [metric('Hesaplama biçimi', result.input.mode === 'simple' ? 'Basit' : 'Hareketli hesap'), metric('Yıllık faiz', `%${esc(result.input.annualInterestRatePercent)}`), metric('Başlangıç / bitiş', `${formatDate(result.input.startDate)} / ${formatDate(result.input.endDate)}`)];
      case 'commercial_discount':
        return [metric('Belge / nominal', `${result.input.documentType === 'cheque' ? 'Çek' : 'Senet'} / ${money(result.nominalAmount)}`), metric('Yıllık iskonto', `%${esc(result.input.annualDiscountRatePercent)}`), metric('İskonto / vade', `${formatDate(result.input.transactionDate)} / ${formatDate(result.input.maturityDate)}`)];
    }
  })().join('');
  const movements = result.productType === 'commercial_revolving' && result.input.mode === 'movements'
    ? `<h2>Hesap hareketleri</h2><table><thead><tr><th>Tarih</th><th>İşlem</th><th>Tutar</th></tr></thead><tbody>${(result.input.movements ?? []).map((movement) => `<tr><td>${formatDate(movement.date)}</td><td>${movement.amount >= 0 ? 'Kullanım' : 'Geri ödeme'}</td><td>${movement.amount < 0 ? '−' : '+'}${money(Math.abs(movement.amount))}</td></tr>`).join('')}</tbody></table>`
    : '';
  const schedule = result.productType === 'commercial_installment'
    ? `<h2>Ödeme planı</h2><table><thead><tr><th>No</th><th>Tarih</th><th>Taksit</th><th>Anapara</th><th>Faiz</th><th>Vergiler</th><th>Kalan</th></tr></thead><tbody>${result.schedule.map((r) => `<tr><td>${r.installmentNumber}</td><td>${formatDate(r.date)}</td><td>${money(r.installment)}</td><td>${money(r.principal)}</td><td>${money(r.interest)}</td><td>${money(r.bsmv + r.kkdf + r.otherTax)}</td><td>${money(r.remainingPrincipal)}</td></tr>`).join('')}</tbody></table>`
    : result.productType === 'commercial_revolving'
      ? `<h2>Faiz dönemleri</h2><table><thead><tr><th>Başlangıç</th><th>Bitiş</th><th>Bakiye</th><th>Faiz</th></tr></thead><tbody>${result.periods.map((r) => `<tr><td>${formatDate(r.startDate)}</td><td>${formatDate(r.endDate)}</td><td>${money(r.openingBalance)}</td><td>${money(r.interest)}</td></tr>`).join('')}</tbody></table>` : '';
  const headline = result.productType === 'commercial_installment' ? `Toplam geri ödeme: ${money(result.totalRepayment)}`
    : result.productType === 'commercial_spot' ? `Vade sonu ödeme: ${money(result.maturityPayment)}`
      : result.productType === 'commercial_discount' ? `Net tutar: ${money(result.netProceeds)}`
        : `Kapanış bakiyesi: ${money(result.closingBalance)}`;
  const contact = contactInfo?.fullName.trim() && contactInfo.phone.trim()
    ? `<section class="contact"><div class="contact-title">İletişim Bilgileri</div><div><span class="label">İsim Soyisim</span><br><b>${esc(contactInfo.fullName.trim())}</b></div><div class="contact-phone"><span class="label">Telefon</span><br><b>${esc(contactInfo.phone.trim())}</b></div></section>`
    : '';
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><style>@page{size:A4;margin:24mm 16mm}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#14213d;font-size:11px}header{border-bottom:3px solid #0b5cad;margin-bottom:24px;padding-bottom:14px}.brand{color:#0b5cad;font-weight:800}.hero{background:#083d77;color:white;border-radius:12px;padding:18px;margin:16px 0;font-size:20px;font-weight:800}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.metric{background:#eef3f8;border-radius:8px;padding:10px}.metric b{display:block;font-size:14px;margin-top:4px}h2{margin-top:24px}table{border-collapse:collapse;width:100%;font-size:9px}th,td{border-bottom:1px solid #d8e1ea;padding:7px 4px;text-align:right}th:first-child,td:first-child{text-align:left}.contact{border:1px solid #d8e1ea;border-radius:8px;padding:12px;margin:16px 0;background:#fff}.contact-title{font-size:13px;font-weight:800;color:#083d77;margin-bottom:8px}.contact-phone{margin-top:8px}.label{color:#607083}.note{color:#607083;margin-top:24px}</style></head><body><header><div class="brand">BANKACI</div><h1>${esc(COMMERCIAL_PRODUCT_LABELS[result.productType])}</h1></header><div class="hero">${headline}</div><h2>İşlem bilgileri</h2><div class="grid">${inputDetails}</div><h2>Maliyet özeti</h2><div class="grid"><div class="metric">Faiz / iskonto<b>${money(result.interest)}</b></div><div class="metric">BSMV<b>${money(result.bsmv)}</b></div><div class="metric">KKDF<b>${money(result.kkdf)}</b></div><div class="metric">Diğer vergi / fon<b>${money(result.otherTax)}</b></div><div class="metric">Toplam finansman maliyeti<b>${money(result.totalFinancingCost)}</b></div></div>${contact}${movements}${schedule}<p class="note">Bu çıktı matematiksel hesaplama amaçlıdır; banka teklifi, muhasebe kaydı veya finansal tavsiye değildir. Oran, vergi, komisyon, valör ve masrafları işlem öncesinde ilgili kurumdan doğrulayın.</p></body></html>`;
};
