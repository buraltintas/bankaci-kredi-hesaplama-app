# Changelog

Önemli kullanıcı ve operasyon değişiklikleri bu dosyada tutulur.

## [Unreleased]

### Added

- E-posta OTP hesabı için SecureStore tabanlı kalıcı session depolaması ve
  bozuk/eksik kayıt doğrulaması.
- Ayarlar ekranında onay isteyen ve backend/push/RevenueCat ayrıştırmasını yapan
  “Hesaptan çık” kontrolü.
- Zorunlu profil adı; isteğe bağlı banka, görev, biyografi ve GCS avatar düzenleme.
- Profil değişikliklerinin kullanıcının ekrandaki mevcut feed gönderilerine anında
  yansıması.
- Doğrulanmış hesap e-postasının, opaque `rc_...` kimliği değiştirmeden destek
  amaçlı RevenueCat subscriber attribute olarak eşlenmesi.

### Fixed

- Geçici ağ, API 5xx veya RevenueCat hatasında kullanıcının sessionının
  temizlenmesi engellendi; yalnız session süresi, kesin API 401 veya kullanıcı
  logout'u çıkış sebebi oldu.
- Uygulama açılışı/arka plandan dönüş isteği ile logout arasındaki yarışın eski
  sessionı yeniden yazabilmesi engellendi.
- Profil düzenleme formu Android klavyesi açıkken kaydırılabilir hâle getirildi.
