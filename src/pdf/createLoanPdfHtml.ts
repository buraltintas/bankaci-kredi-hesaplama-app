import { formatCurrency } from '../utils/formatCurrency';
import { formatDate } from '../utils/dateMath';
import type { LoanCalculationResult } from '../domain/loan/types';

export type LoanPdfContactInfo = {
  fullName: string;
  phone: string;
};

const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const getPlanTypeLabel = (result: LoanCalculationResult): string =>
  result.planType === 'prepaidInterest'
    ? 'Peşin Faiz Ödemeli'
    : result.planType === 'equalPrincipal'
      ? 'Eşit Anapara Ödemeli'
      : 'Standart Sabit Taksitli';

const formatPercent = (
  value: number,
  maximumFractionDigits = 4,
  minimumFractionDigits = 0
): string =>
  `%${value.toLocaleString('tr-TR', {
    maximumFractionDigits,
    minimumFractionDigits,
  })}`;

export const createLoanPdfHtml = (
  result: LoanCalculationResult,
  contactInfo?: LoanPdfContactInfo
): string => {
  const hasBrokenPeriod = result.brokenPeriod.diffDays !== 0;
  const isPrepaidInterest = result.planType === 'prepaidInterest';
  const isEqualPrincipal = result.planType === 'equalPrincipal';
  const hasContactInfo =
    Boolean(contactInfo?.fullName.trim()) && Boolean(contactInfo?.phone.trim());
  const rows = result.schedule
    .map(
      (item) => `
        <tr>
          <td>${item.installmentNumber}</td>
          <td>${formatDate(item.date)}</td>
          <td>${formatCurrency(item.principal)}</td>
          <td>${formatCurrency(item.interest)}</td>
          <td>${formatCurrency(item.kkdf)}</td>
          <td>${formatCurrency(item.bsmv)}</td>
          <td>${formatCurrency(item.installment)}</td>
          <td>${formatCurrency(item.remainingPrincipal)}</td>
        </tr>`
    )
    .join('');

  return `<!doctype html>
  <html lang="tr">
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #14213D; margin: 28px; }
        h1 { font-size: 24px; margin: 0; color: #083D77; }
        h2 { font-size: 16px; margin: 4px 0 20px; color: #607083; }
        .summary { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 18px 0; }
        .box { border: 1px solid #D8E1EA; border-radius: 8px; padding: 10px; background: #F8FAFC; }
        .label { color: #607083; font-size: 11px; margin-bottom: 4px; }
        .value { font-weight: 700; font-size: 13px; }
        table { border-collapse: collapse; width: 100%; font-size: 10px; margin-top: 18px; }
        th { background: #083D77; color: #fff; text-align: left; padding: 7px 5px; }
        td { border-bottom: 1px solid #E6ECF2; padding: 6px 5px; }
        tr { page-break-inside: avoid; }
        .note { margin-top: 18px; color: #607083; font-size: 10px; }
        .broken { border-left: 4px solid #E67700; padding-left: 10px; margin: 16px 0; font-size: 12px; }
        .contact { border: 1px solid #D8E1EA; border-radius: 8px; padding: 12px; margin: 16px 0; background: #FFFFFF; }
        .contact-title { font-size: 13px; font-weight: 800; color: #083D77; margin-bottom: 8px; }
      </style>
    </head>
    <body>
      <h1>${escapeHtml('Kredi Ödeme Planı')}</h1>
      <section class="summary">
        <div class="box"><div class="label">Kredi kullanım tarihi</div><div class="value">${formatDate(result.input.creditUsageDate)}</div></div>
        <div class="box"><div class="label">İlk taksit tarihi</div><div class="value">${formatDate(result.input.firstInstallmentDate)}</div></div>
        <div class="box"><div class="label">Kredi tutarı</div><div class="value">${formatCurrency(result.input.principal)}</div></div>
        <div class="box"><div class="label">Vade</div><div class="value">${result.input.term} ay</div></div>
        <div class="box"><div class="label">Ödeme Planı Tipi</div><div class="value">${getPlanTypeLabel(result)}</div></div>
        <div class="box"><div class="label">${isPrepaidInterest ? 'Baz aylık faiz oranı' : 'Aylık faiz oranı'}</div><div class="value">${formatPercent(result.input.monthlyInterestRatePercent)}</div></div>
        <div class="box"><div class="label">KKDF / BSMV</div><div class="value">%${result.input.kkdfRatePercent} / %${result.input.bsmvRatePercent}</div></div>
        ${
          isPrepaidInterest
            ? `<div class="box"><div class="label">İndirimli faiz oranı</div><div class="value">${formatPercent(
                (result.discountedMonthlyRate ?? 0) * 100,
                3,
                3
              )}</div></div>
              <div class="box"><div class="label">0. taksit peşin faiz</div><div class="value">${formatCurrency(result.realizedPrepaidInterest ?? 0)}</div></div>`
            : ''
        }
        ${
          isEqualPrincipal
            ? `<div class="box"><div class="label">Aylık anapara</div><div class="value">${formatCurrency(
                result.monthlyPrincipalAmount ?? 0
              )}</div></div>
              <div class="box"><div class="label">Son taksit tutarı</div><div class="value">${formatCurrency(
                result.lastInstallmentAmount ?? 0
              )}</div></div>`
            : `<div class="box"><div class="label">${isPrepaidInterest ? 'Aylık taksit' : 'Standart aylık taksit'}</div><div class="value">${formatCurrency(result.standardInstallment)}</div></div>`
        }
        <div class="box"><div class="label">İlk taksit tutarı</div><div class="value">${formatCurrency(result.firstInstallment)}</div></div>
        <div class="box"><div class="label">Toplam ödeme</div><div class="value">${formatCurrency(result.totalPayment)}</div></div>
        <div class="box"><div class="label">Toplam faiz / KKDF / BSMV</div><div class="value">${formatCurrency(result.totalInterest)} / ${formatCurrency(result.totalKkdf)} / ${formatCurrency(result.totalBsmv)}</div></div>
      </section>
      ${
        hasBrokenPeriod
          ? `<section class="broken">
              <strong>Kırık dönem farkı sadece 1. taksite yansıtılmıştır.</strong><br />
              Gün farkı: ${result.brokenPeriod.diffDays}<br />
              Faiz farkı: ${formatCurrency(result.brokenPeriod.interestDiff)}<br />
              KKDF farkı: ${formatCurrency(result.brokenPeriod.kkdfDiff)}<br />
              BSMV farkı: ${formatCurrency(result.brokenPeriod.bsmvDiff)}
            </section>`
          : ''
      }
      ${
        hasContactInfo && contactInfo
          ? `<section class="contact">
              <div class="contact-title">İletişim Bilgileri</div>
              <div><span class="label">İsim Soyisim</span><br /><span class="value">${escapeHtml(contactInfo.fullName.trim())}</span></div>
              <div style="margin-top: 8px;"><span class="label">Telefon</span><br /><span class="value">${escapeHtml(contactInfo.phone.trim())}</span></div>
            </section>`
          : ''
      }
      <table>
        <thead>
          <tr>
            <th>No</th>
            <th>Tarih</th>
            <th>Anapara</th>
            <th>Faiz</th>
            <th>KKDF</th>
            <th>BSMV</th>
            <th>Taksit</th>
            <th>Kalan</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="note">Bu hesaplama bilgilendirme amaçlıdır. Bankaların nihai hesaplama yöntemleri, masraf ve ödeme planı uygulamaları farklılık gösterebilir.</p>
    </body>
  </html>`;
};
