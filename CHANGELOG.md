# Changelog

## Unreleased — Push tanısı ve talep/hesaplama düzeltmeleri

- iOS'ta izin verildikten hemen sonra APNs cihaz token'ı çoğu zaman hazır
  olmadığından `getExpoPushTokenAsync` ilk denemede hata verebiliyor; token
  alımı artık kısa bir backoff ile birkaç kez deneniyor. Cihazın hiç
  kaydolamamasının muhtemel sebebi buydu.
- Push kaydı başarısız olduğunda hata (hangi aşamada ve neden) Ayarlar'daki
  bildirim kartında gösteriliyor. iOS'ta cihazın sessizce hiç kaydolmamasının
  sebebini yüzeye çıkarmak için geçici bir tanı; sebep bulununca kaldırılacak.
- Talepler: bir talebin durumu (Görüşüldü / Kapandı) artık kartta rozet olarak
  görünüyor ve seçili durum butonu vurgulanıyor; aynı butona tekrar dokunmak
  durumu "Yeni"ye geri alıyor. Güncelleme başarısız olursa uyarı gösteriliyor.
  Ekranı aşağı çekince talepler yenileniyor.
- Konut Devir ve Mevduat ekranlarında sekmelerin altındaki içerik, Bireysel ve
  Ticari ekranlarla aynı üst boşluğu alıyor.

## Unreleased — Balon ödeme planı banka hesabıyla eşitlendi

- Özel / balon ödeme planında otomatik taksitler artık her dönem **eşit** (bankaların yaptığı gibi); önceki sürüm özel ödemelerden sonra taksitleri kalan vadeye yeniden yayarak azaltıyordu. Tek bir uniform taksit, özel ödemeler dahil çizelgeyi vade sonunda sıfıra indirecek şekilde çözülüyor; son otomatik taksit yuvarlama farkını yutuyor. Gerçek bir İş Bankası ödeme planıyla kuruş kuruşuna doğrulandı.
- Vade sonunda özel ödeme, vade düşümü ve çok sayıda ara ödeme durumları da eşit-taksit modeliyle doğru çözülüyor. Eşit taksitin faizi karşılayamayacağı kadar büyük ve erken bir balon (negatif amortizasyon gerektiren) geçersiz kabul edilip reddediliyor.

## Unreleased — Talep yönetimi ve hesaplama menüsü

- Alt menü `Hesaplama`, `Talepler`, `Öğle Arası`, `Ayarlar` olarak sadeleştirildi.
- Mevduat, Bireysel/Ticari/Konut Devir ile aynı hesaplama sekmesine taşındı.
- Giriş yapmış Premium kullanıcılar için tek kalıcı talep linki, gelen talep akordeonları, güvenli belgeler, arama/WhatsApp, kişisel notlar ve paylaşılabilir görseller eklendi.
- Talep linkine ayrı kopyalama aksiyonu ve WhatsApp uyumlu kısa paylaşım adresi eklendi; bağlantı önizlemesinin başlığı güncel profil adını, görseli genel güvenli talep mesajını kullanıyor.
- PNG paylaşım görseli üreticisine düzenlenebilir özel metin, isteğe bağlı isim ve telefon, beş renk paleti ve üç farklı tasarım şablonu eklendi; görsel içindeki “Bankacı” ibaresi kaldırıldı.
- Talepler / Notlar / Görsel sekmeleri hesaplama ekranıyla aynı yarı saydam yüzey, kayan kısa alt çizgi, renk geçişi ve scroll sırasında sticky davranışına geçirildi.
- Hesaplama ve Talepler sticky tablarının altındaki bileşen marjı ile ekran boşluğunun üst üste binmesi kaldırıldı; içerik aralığı tek standart boşluğa indirildi.
- Yorum yazma alanı tüm modalı saran klavye kaçınması, cihaz safe-area ölçüsü,
  ayrı alt panel ve dengeli input/gönder butonu yerleşimiyle yeniden kuruldu.

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
