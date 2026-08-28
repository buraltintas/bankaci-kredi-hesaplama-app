/** Apple's standard EULA — acceptable as the Terms of Use link on a paywall. */
export const TERMS_URL =
  'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

export const PRIVACY_URL = 'https://bankaci.burak-altintas.com/privacy/';

export const PAYWALL_TITLE = 'Premium Bankacı';
export const PAYWALL_SUBTITLE =
  'Gelişmiş hesaplama araçlarının kilidini açın; banner ve geçiş reklamları olmadan kesintisiz çalışın.';

export const PAYWALL_BENEFITS = [
  'Hiçbir reklam gösterilmez',
  'Konut kredisi devir hesaplama',
  'PDF ve paylaşım akışları beklemeden açılır',
  'Tüm detaylı ödeme planı ve hesaplama özellikleri dahil',
  'Öğle Arası’nda sosyal paylaşım yapabilme',
  'Müşteri talep linki ve gelen talepleri yönetme',
  'Kişisel notlar ve paylaşılabilir görseller',
] as const;

/**
 * Auto-renewal disclosure. Apple requires the renewal terms to be visible on
 * the purchase screen itself, not only in the store sheet.
 */
export const AUTO_RENEW_DISCLOSURE =
  'Abonelik, iptal edilmediği sürece dönem sonunda otomatik yenilenir. Yenileme ücreti, dönem bitiminden 24 saat önce hesabınızdan tahsil edilir. Aboneliğinizi App Store veya Google Play hesap ayarlarından yönetebilir ve iptal edebilirsiniz. Ömür boyu seçeneği tek seferlik ödemedir, yenilenmez.';

export const PLATFORM_SCOPE_NOTE =
  'Abonelik, satın alındığı mağazada geçerlidir. Aynı Apple ID veya Google hesabıyla yeni bir cihaza geçtiğinizde otomatik olarak taşınır.';
