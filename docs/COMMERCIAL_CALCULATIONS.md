# Ticari kredi hesaplamaları

Bu belge `Bireysel / Ticari` ayrımındaki ticari hesaplayıcıların matematik ve ürün kararlarının kalıcı kaynağıdır. Hesaplayıcı teklif üretmez; kullanıcı banka/sözleşme oranlarını girer. Para işlemleri `decimal.js` ile, `ROUND_HALF_UP` ve kuruş hassasiyetinde yapılır.

## Ürünler ve formüller

- **Taksitli ticari kredi:** aylık, üç aylık veya altı aylık eşit ödeme. Sözleşmesel ay periyodu kullanılır. Standart tarihten farklı ilk ödeme için kırık dönem farkı `anapara × aylık oran × gün farkı / 3000` olarak eklenir. Her satırda faiz, BSMV, KKDF ve diğer fon ayrı kuruşa yuvarlanır; son satır kalan anaparayı sıfırlar.
- **Spot kredi:** ACT/360 basit faiz: `anapara × yıllık oran × gerçek gün / 36000`. Vade sonunda anapara, faiz ve vergiler birlikte ödenir.
- **Rotatif / BCH:** basit biçimde tek bakiye; hareketli hesapta ise her kullanım/geri ödeme arasındaki gerçek gün ve o aralıktaki bakiye ayrı hesaplanır. Aynı tarihli hareketler birleştirilir, bakiye altına inen geri ödeme reddedilir. Başlangıç dahil, bitiş hariç ACT/360 uygulanır. Alt-kuruş faizler hareket başına yuvarlanmaz; seçilen tahakkuk dönemi boyunca hassas biriktirilip dönem sonunda kuruşa yuvarlanır. Ekrandaki hareket tarihi **faize esas valör tarihidir**. Örneğin Halkbank kullanım valörünü aynı gün, geri ödeme valörünü bir iş günü sonrası olarak açıklamaktadır; uygulama banka takvimini tahmin etmez.
- **Çek / senet iskonto:** ACT/360 iskonto tutarı ve onun vergileri nominal değerden düşülür; net ele geçen tutar gösterilir. TCMB reeskont yönteminde iskonto günü faize dahil edildiği için ekran varsayılanı “dahil”dir; banka sözleşmesi farklıysa kullanıcı “hariç” seçebilir. Tatil gününe denk gelen vadenin düzeltilmesi banka/ürün takvimine bağlıdır; kullanıcı bankanın faize esas aldığı tarihi girer. Çoklu çeklerin ağırlıklı ortalama vadesi bu sürümde otomatik hesaplanmaz.

Varsayılan ticari oranlar BSMV `%5`, KKDF `%0`, diğer fon `%0` olarak yalnız başlangıç değeri sunar. Hepsi düzenlenebilir. Bankanın komisyon, tahsis, sigorta, değer tarihi veya ürüne özel vergi uygulaması ayrıca doğrulanmalıdır.

## Resmî dayanaklar

- [İş Bankası – Spot Kredi Nedir, Nasıl Hesaplanır?](https://www.isbank.com.tr/blog/spot-kredi-nedir-nasil-hesaplanir): ACT/360 formülü ve vade sonu ödeme örneği.
- [Akbank – KOBİ Kredi Kampanyası](https://www.akbank.com/kampanyalar/akbank-kobilerin-yaninda): 100.000 TL, 36 ay, aylık `%4,89` ve `%5` BSMV ile yaklaşık 6.148 TL taksit/221.336 TL toplam ödeme; taksit motorunun resmî altın testi.
- [İş Bankası – Ticari Ek Hesap](https://www.isbank.com.tr/is-ticari/ticari-ek-hesap): günlük faiz, aynı gün kullanımda asgari bir gün ve faiz/vergi örneği.
- [Halkbank – Açık Hesap Faiz Hesaplama](https://www.halkbank.com.tr/tr/hesaplama-araclari/acik-hesap-faiz-hesaplama): kullanılan tutar ve gün üzerinden faiz; kullanımın aynı gün, geri ödemenin bir iş günü sonrası valörlenmesi yaklaşımı.
- [Ziraat Bankası – Rotatif Krediler](https://www.ziraatbank.com.tr/tr/kurumsal/krediler/nakdi-krediler/rotatif-krediler): rotatif faiz tahakkuk dönemleri.
- [İş Bankası – TL Çek İskontosu / İştirası](https://www.isbank.com.tr/is-ticari/tl-cek-iskontosu-istirasi-kredisi): banka ile vade arasındaki faiz ve BSMV'nin nominalden düşülmesi.
- [TCMB – İhracat Reeskont Kredisi Uygulama Talimatı](https://www.tcmb.gov.tr/wps/wcm/connect/36dbca10-791d-4a7f-84cb-f6b4de48a3ec/%C4%B0hracat%2Bve%2BD%C3%B6viz%2BKazand%C4%B1r%C4%B1c%C4%B1%2BHizmetler%2BReeskont%2BKredisi%2BUygulama%2BTalimat%C4%B1%2BAral%C4%B1k%2B2020.pdf?MOD=AJPERES): 360 gün sabit bölen ve tatil günündeki vadenin izleyen iş gününe taşınması.
- [Gelir İdaresi Başkanlığı – Güncel KKDF oranları](https://cdn.gib.gov.tr/api/gibportal-file/file/getFileResources?objectKey=arsiv%2Fyardim-kaynaklar%2Fyararli-bilgiler%2Fkkdf-oranlari.pdf): tüketici kredileri dışındaki TL kredilerinde KKDF oranının `%0` olduğu güncel oran tablosu.

## Ürün ve erişim kararları

- Bireysel ekran varsayılan sekmedir ve eski hesaplama akışı değiştirilmemiştir.
- Ticari hesaplama ve sistem paylaşım metni ücretsizdir. Premium olmayan kullanıcıda yalnız geçerli bir hesap üretildikten sonra hesaplama akışında ve paylaşım öncesinde hazırsa geçiş reklamı gösterilir; geçersiz form reklam tetiklemez.
- Sonuç altında banner ve “Reklamları kaldır” aksiyonu yalnız Premium olmayan, Premium durumu çözümlenmiş kullanıcıda gösterilir. Premium kullanıcı hiçbir ticari reklam yüzeyini görmez.
- Ticari PDF dışa aktarma Premium yetkisi ister.
- Son 20 ticari hesaplama cihazda tutulur ve yeniden açılabilir.
- Analytics kişisel veri göndermez; `loan` calculator altında yalnız `commercial_installment`, `commercial_spot`, `commercial_revolving`, `commercial_discount` varyantlarını ve sayısal özetleri yollar.

## Doğrulama

`src/domain/commercial/commercialCalculations.test.ts` resmî spot ve rotatif örneklerini; 1/360 gün, artık gün ve yaz saati sınırlarını; 1/3/6 aylık planları; sıfır faiz, yüksek oran, aşırı tarih/tutar, hatalı valör, tam geri ödeme, aynı gün hareket birleştirme, alt-kuruş tahakkuk, iskonto eşiği ve satır/toplam mutabakatlarını kapsar. Değişiklikte `npm run test:ci`, `npm run typecheck`, `npm run lint` ve iOS/Android Expo export çalıştırılmalıdır.
