# Changelog

Önemli kullanıcı ve operasyon değişiklikleri bu dosyada tutulur.

## [Unreleased]

### Changed

- Mobil ve web marka rozetlerinde büyük harf yazımı locale dönüşümüne
  bırakılmadan sabit `PREMIUM` olarak kullanılıyor.
- Konut devir ekranının uzun başlığı mobil yerleşim için “Konut Kredisi Devir”
  olarak kısaltıldı.
- Ticari paylaşım ve PDF çıktılarından müşteriye yönelik olmayan gün hesabı
  terminolojisi kaldırıldı; ticari PDF'ye bireysel hesaplamayla ortak saklanan
  isteğe bağlı isim ve telefon iletişim bloğu eklendi.
- Profil adını henüz güncellememiş kullanıcıların görünen adı e-posta adresinin
  `@` öncesinden türetiliyor; kullanıcı profil adını değiştirdiğinde kendi seçimi
  gösteriliyor ve görünen ad için benzersizlik şartı uygulanmıyor.

### Added

- Ayarlar sayfasının en altında, mağaza aboneliği uyarısı ve iki aşamalı
  geri alınamaz işlem onayı içeren uygulama içi hesap silme akışı.

- Kredi ekranında varsayılanı Bireysel olan Bireysel / Ticari ayrımı.
- Taksitli ticari, spot, rotatif/BCH (basit ve hareketli hesap) ile çek/senet
  iskonto hesaplamaları; düzenlenebilir BSMV, KKDF ve diğer fon oranları.
- Kuruş hassasiyetli ticari hesaplama çekirdeği, ödeme/faiz dönemleri, son 20
  ticari hesaplama geçmişi, ücretsiz paylaşım ve Premium PDF çıktısı.
- Ticari varyantlar için kişisel veri içermeyen hesaplama analytics olayları.
- Premium olmayan kullanıcılar için geçerli ticari hesaplama ve paylaşım
  akışlarına geçiş reklamı, ticari sonuç altına banner ve “Reklamları kaldır”
  aksiyonu; Premium kullanıcılar için tüm ticari reklam yüzeylerinin kapatılması.

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

- Rotatif/BCH hareketlerinde alt-kuruş faizlerin her hareket satırında erken
  yuvarlanması kaldırıldı; faiz tahakkuk dönemi boyunca hassas biriktirilip
  dönem sonunda kuruşa yuvarlanıyor ve dönem satırları toplamla mutabık kalıyor.
- Aşırı tutar/oran/tarih kombinasyonlarının sonsuz veya güvenli sınır dışı sonuç
  üretmesi, hareket bakiyesinin limiti aşması ve çok erken ilk taksidin negatif
  faiz üretmesi açık doğrulama hatalarıyla engellendi.
- Tamamen geri ödenmiş hareketli rotatif hesapların analytics özetinde sıfır
  anapara nedeniyle reddedilmesi, tepe kullanılan bakiye raporlanarak düzeltildi.
- Rotatif hareket tarihleri valör tarihi, iskonto vadesi faize esas vade olarak
  netleştirildi; bankaya özgü iş günü/değer tarihi farkları kullanıcıya açıklandı.

- Geçici ağ, API 5xx veya RevenueCat hatasında kullanıcının sessionının
  temizlenmesi engellendi; yalnız session süresi, kesin API 401 veya kullanıcı
  logout'u çıkış sebebi oldu.
- Uygulama açılışı/arka plandan dönüş isteği ile logout arasındaki yarışın eski
  sessionı yeniden yazabilmesi engellendi.
- Profil düzenleme formu Android klavyesi açıkken kaydırılabilir hâle getirildi.
