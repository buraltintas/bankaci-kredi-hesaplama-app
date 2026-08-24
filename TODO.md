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

## P1 — Kredi ve mevduat kampanyaları

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

## Tamamlanan önemli işler

- [x] Konut kredisi devir/transfer hesaplaması ve paylaşımı eklendi.
- [x] Transfer özelliği Bankacı Premium kapsamına alındı.
- [x] Premium kullanıcılar için banner, geçiş reklamları ve reklam kaldırma çağrıları kapatıldı.
- [x] Premium kontrolü sırasında güvenli loading ve çevrimdışı fail-open akışı eklendi.
- [x] Android backendsiz force update altyapısı eklendi.
- [x] Uygulama sürümü `3.1.0` olarak güncellendi.
