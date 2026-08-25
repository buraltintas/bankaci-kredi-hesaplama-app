# Bankacı TODO

## P0 — Release ve gelir akışı doğrulamaları

- [ ] RevenueCat sandbox satın alma akışlarını gerçek iOS ve Android cihazlarda uçtan uca test et.
  - Aylık, yıllık ve ömür boyu paketleri ayrı ayrı doğrula.
  - Satın alma sonrası paywall'ın kapandığını, bütün premium özelliklerin açıldığını ve tüm reklamların kaybolduğunu kontrol et.
  - Uygulamayı silip yeniden kurma, yeni cihaz ve "Satın alımları geri yükle" senaryolarını test et.
  - Abonelik süresi dolduğunda ücretsiz özelliklerin ve reklamların geri geldiğini doğrula.
  - Çevrimdışı açılış ve internetin sonradan geri gelmesi senaryolarını iki platformda test et.
- [ ] RevenueCat panelinde aylık, yıllık ve ömür boyu ürünlerin tamamının `premium` entitlement'ına bağlı olduğunu doğrula.
- [ ] Android force update akışını Google Play test kanalında eski bir `versionCode` ile gerçek cihazda doğrula.
- [ ] Her Android production release sonrasında EAS'in ürettiği gerçek `versionCode` ile `force-update.json` dosyasını güncelle.
- [ ] Production build'leri mağazalara göndermeden önce kredi, transfer, mevduat, PDF, paylaşım ve reklam akışlarında manuel smoke test yap.
- [ ] E-posta üyeliği ve cihazlar arası Premium geçişini RevenueCat sandbox'ta test et.
  - Mevcut anonim premium kullanıcının ilk kez e-posta hesabına girişini doğrula.
  - Aynı e-posta hesabıyla ikinci iOS/Android cihazda Premium'un açıldığını doğrula.
  - Hesaptan çıkış, çevrimdışı açılış ve bağlantının sonradan gelmesi senaryolarında başka hesabın entitlement'ının taşınmadığını doğrula.

## P0 — API production kurulumu

- [ ] PostgreSQL oluştur, `bankaci-migrate` job'ını çalıştır ve migration checksum tablosunu doğrula.
- [ ] OTP e-posta sağlayıcısını seçip SMTP env'lerini tanımla; SPF, DKIM ve DMARC kayıtlarını doğrula.
- [ ] Google Cloud Storage bucket'ını uniform IAM ile oluştur; API runtime service account'una `roles/storage.objectCreator` ver.
- [ ] Profil/feed görselleri için public-read veya Cloud CDN adresini hazırlayıp `GCS_PUBLIC_BASE_URL` olarak tanımla.
- [ ] RevenueCat webhook URL ve Authorization değerini tanımla; production ve sandbox olaylarını ayrı ayrı test et.
- [ ] EAS push security'yi aç, `EXPO_PUSH_ACCESS_TOKEN` env'ini ekle, Android FCM V1 ve iOS APNs credential'larını tanımla.
- [ ] Yorum bildirimi gönderme, uygulama açık/arka planda/kapalıyken alma, bildirime dokunma ve `DeviceNotRegistered` receipt akışını iki platformda test et.
- [ ] Receipt worker için Cloud Run minimum instance veya Cloud Scheduler/ayrı job çalışma modelini production maliyetine göre seç.
- [ ] EAS production ortamına `EXPO_PUBLIC_BANKACI_API_URL` ekle ve yeni native build al.
- [ ] Topluluk kuralları, KVKK/aydınlatma metni, içerik kaldırma iletişim kanalı ve yönetici moderasyon ekranını yayından önce tamamla.
- [ ] Üyelik yayınlanmadan önce Ayarlar/Profil içinde kolay bulunan “Hesabı sil”
  akışını ve API'de session, push tokenı, profil, GCS avatarı ve kullanıcıya ait
  feed içeriğini kapsayan doğrulamalı silme endpoint'ini tamamla. Hesap silmenin
  App Store/Google Play aboneliğini otomatik iptal etmediğini kullanıcıya göster.
- [ ] Google Cloud, RevenueCat, Expo ve SMTP için KVKK m.9 yurt dışı aktarım
  mekanizmasını hukuk danışmanıyla kesinleştir; gerekiyorsa standart sözleşme
  bildirimlerini veya aydınlatmadan ayrı açık rıza akışını tamamla.
- [ ] `bankaci.app/privacy` sürüm 3.0 metnini mobil üyelik ekranında veri elde
  edilmeden önce erişilebilir kıl ve gösterimin/ispatın release kaydını tut.
- [ ] Expo SDK 54 bağımlılık ağacındaki `npm audit` bulgularını SDK 57 yükseltme planıyla kapat; major yükseltmeyi ayrı branch'te iOS/Android regresyon testiyle yap.

## P1 — Kredi ve mevduat kampanyaları

- [ ] Kampanya listeleme API'sini yalnızca giriş yapmış Premium bankacılara aç; mobil gizlemenin yanında API'de de `premium_required` doğrulaması yap.

- [ ] Kredi ve mevduat kampanyalarının güvenilir ve sürdürülebilir biçimde hangi kaynaklardan alınabileceğini araştır.
  - Öncelikle bankaların resmi kampanya sayfalarını, ürün sayfalarını ve varsa resmi API/feed seçeneklerini incele.
  - Karşılaştırma platformlarının API, lisans, kullanım koşulları, kaynak gösterme ve ticari kullanım şartlarını kontrol et.
  - Robots.txt veya kullanım koşullarına aykırı client-side scraping yapma.
  - Kaynak başına güncellenme sıklığını, veri kalitesini ve kampanya bitiş tarihinin bulunup bulunmadığını değerlendir.
  - Manuel yönetilen JSON, zamanlanmış backend toplama veya lisanslı API seçeneklerini maliyet/bakım açısından karşılaştır.
- [ ] Seçilen kampanya kaynağı için ortak veri modelini oluştur.
  - Banka, ürün türü, kampanya başlığı, faiz oranı/getiri, vade, alt-üst tutar, geçerlilik tarihi, koşullar, kaynak URL ve son güncellenme zamanı alanlarını kapsa.
- [ ] Kampanya verisini güvenli bir backend veya yönetilen feed üzerinden uygulamaya bağla.
- [ ] Kredi ve mevduat ekranlarında kampanya listeleme, boş durum, hata, offline cache ve son güncellenme bilgisini tasarla ve uygula.
- [ ] Süresi biten kampanyaların otomatik gizlenmesini ve hatalı/eski verinin kullanıcıya açıkça belirtilmesini sağla.

## P2 — iOS force update

- [ ] Android yapısını bozmadan `force-update.json` dosyasına ayrı bir `ios` politikası ekle.
- [ ] iOS için semantic app version karşılaştırması geliştir ve test et.
- [ ] Zorunlu güncelleme gerektiğinde kapatılamayan ekran üzerinden App Store'a yönlendir.
- [ ] İnternet, GitHub veya JSON erişilemezse uygulamanın açılmaya devam etmesini sağla.
- [ ] Yeni iOS sürümü App Store'da indirilebilir olmadan minimum sürümü yükseltme.
- [ ] iOS production release prosedürünü README'ye ekle.

## P2 — Altyapı ve operasyon

- [ ] Repo private yapılacaksa `force-update.json` için public ve kalıcı bir barındırma adresi seç; uygulamadaki `CONFIG_URL` değerini değiştir.
- [ ] Force-update cache politikasına süre/son kullanma davranışı gerekip gerekmediğini değerlendir; erişilemeyen uzaktaki dosya nedeniyle eski bir zorunlu kararın süresiz kalmasını engelle.
- [ ] Paywall'daki RevenueCat destek kimliğinin gerçek iOS ve Android build'lerinde göründüğünü ve seçilip kopyalanabildiğini manuel doğrula.

## P2 — Premium widget ve talep formu

- [ ] iOS App Group ve Android paylaşımlı depolama üzerinden Premium entitlement özetini widget extension'ına aktar; ücretsiz veya durumu belirsiz kullanıcıda widget hesaplamasını kilitleyip uygulamadaki paywall'a yönlendir.
- [ ] Talep formu oluşturma, link yönetimi ve gelen talepleri görüntüleme uçlarını yalnızca Premium bankacıya aç.
- [ ] Müşteriye gönderilen süreli ve tahmin edilemez talep formu linkini üyelik istemeden aç; form sahibinin Premium durumu sona ererse yeni talep kabul politikasını ayrıca belirle.
- [ ] Feed okumasını herkese açık; beğeni, yorum, bildirme ve engellemeyi giriş yapan üyelere açık; gönderi/fotoğraf paylaşımını yalnızca Premium üyelere açık tut.

## Tamamlanan önemli işler

- [x] Konut kredisi devir/transfer hesaplaması ve paylaşımı eklendi.
- [x] Transfer özelliği Bankacı Premium kapsamına alındı.
- [x] Premium kullanıcılar için banner, geçiş reklamları ve reklam kaldırma çağrıları kapatıldı.
- [x] Premium kontrolü sırasında güvenli loading ve çevrimdışı fail-open akışı eklendi.
- [x] Android backendsiz force update altyapısı eklendi.
- [x] Uygulama sürümü `3.1.0` olarak güncellendi.
- [x] E-posta hesabı sessionı SecureStore'da kalıcı hâle getirildi; yalnız süre
  sonu, kesin API 401 veya kullanıcı logout'u sessionı temizler.
- [x] Ayarlar'a onaylı “Hesaptan çık” akışı eklendi; geç gelen `/me` isteğinin
  kullanıcıyı yanlışlıkla yeniden login etmesi engellendi.
- [x] İsim zorunlu; banka, görev, biyografi ve avatar isteğe bağlı profil
  düzenleme akışı eklendi. Güncel profil feed gönderilerine yansıtıldı.
## P1 — Hesaplama analitiği

- [x] Gizlilik/KVKK metnine takma kimlikli hesaplama analitiğini; gönderilen
  alanları, 180 günlük saklamayı ve en az 20 kurulumlu toplu rapor sınırını ekle.
- [x] Ayarlar'daki “Gizlilik ve veriler” bölümünde hesaplama kullanım verisini
  açıkla; kapatılamayan yanıltıcı switch gösterme.
- [ ] App Store Privacy ve Google Play Data Safety beyanlarında sunucuya gönderilen hesaplama tutarı/oranı gibi finansal kullanım verilerini doğru sınıflandır.
- [ ] `ANALYTICS_HASH_KEY` için üretimde en az 32 karakterlik rastgele bir secret tanımla; sonradan değiştirmek tekil cihaz metriklerinin sürekliliğini keser.
- [ ] Yalnızca `calculation_analytics_safe_daily` görünümündeki en az 20 farklı kurulum içeren, aralıklara ayrılmış grupları dış raporlarda kullan; ham olayları dışarı açma.
- [ ] Ham hesaplama olaylarının 180 günlük saklama süresini hukuk/gizlilik değerlendirmesine göre kesinleştir.
- [ ] Public analitik kabul ucunu Cloud Armor/API Gateway üzerinde oran sınırıyla koru; veri kalitesi kritik hâle gelirse iOS App Attest ve Android Play Integrity tabanlı uygulama doğrulaması ekle.
