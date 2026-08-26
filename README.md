# Bankacı: Kredi Hesaplama

Bankacı: Kredi Hesaplama, kredi ödeme planlarını sahada ve müşteri görüşmelerinde hızlıca oluşturmak için geliştirilmiş Expo / React Native uygulamasıdır.

Uygulama standart kredi hesaplamasının yanında bankacılıkta sık kullanılan gelişmiş ödeme planlarını, PDF çıktısını, paylaşım metnini ve son hesaplamalar geçmişini destekler.

## Mağaza Linkleri

- iOS: [App Store](https://apps.apple.com/tr/app/bankac%C4%B1-kredi-hesaplama/id6742378996)
- Android: [Google Play](https://play.google.com/store/apps/details?id=com.xewor.bankacikredihesaplama)

## Özellikler

- Standart sabit taksitli kredi hesaplama
- Peşin faiz ödemeli plan
- Eşit anapara ödemeli plan
- Özel / balon ödeme planı
- Anapara ödemesiz dönemli plan
- Artan taksitli plan
- İlk taksit tarihi ve kırık dönem desteği
- Opsiyonel "ilk taksit ertelemesini vadeden düş" davranışı
- KKDF / BSMV dahil efektif taksit ve toplam hesapları
- PDF oluşturma ve paylaşım
- Son 20 hesaplama geçmişi
- AdMob interstitial reklam akışı
- Android ve iOS native development build desteği
- E-posta + tek kullanımlık kodla Bankacı hesabı
- SecureStore'da kalıcı 90 günlük session ve açık kullanıcı çıkışı
- İsim, isteğe bağlı banka/görev/biyografi ve GCS avatar profili
- Public feed okuma; Premium kullanıcı için profil bilgili paylaşım
- Bireysel / Ticari kredi ayrımı; taksitli ticari, spot, rotatif/BCH ve çek/senet
  iskonto hesaplamaları
- Hareket bazlı rotatif faiz dönemleri, ticari hesaplama geçmişi ve paylaşım
- Premium ticari PDF raporu

Ticari ürünlerin formülleri, varsayımları ve resmî dayanakları için
[`docs/COMMERCIAL_CALCULATIONS.md`](docs/COMMERCIAL_CALCULATIONS.md) belgesine bakın.

## Üyelik ve session davranışı

- Session token yalnız işletim sisteminin güvenli `SecureStore` alanında tutulur;
  uygulama yeniden açıldığında geçerliyse otomatik geri yüklenir.
- Geçici internet, timeout, API `5xx` veya RevenueCat erişim sorunu kullanıcıyı
  logout etmez; cached session ve Premium durumu korunur.
- Session yalnız süresi dolduğunda, API kesin `401 Unauthorized` döndürdüğünde
  veya kullanıcı Ayarlar'daki “Hesaptan çık” butonunu onayladığında temizlenir.
- Logout yerel tokenı önce siler, backend sessionını revoke etmeyi ve cihaz push
  tokenını kapatmayı best-effort tamamlar; RevenueCat cihazı guest kimliğine döner.
- Profil adı zorunludur. Banka/kurum, görev/unvan, biyografi ve avatar isteğe
  bağlıdır. Feed sorguları yazarın güncel profilini kullanıcı tablosundan okur.
- RevenueCat entitlement kimliği opaque `rc_...` olarak kalır. Doğrulanmış hesap
  e-postası destek sırasında RevenueCat panelinde kullanıcıyı bulabilmek için
  RevenueCat subscriber attribute olarak aktarılır. Bu metadata aktarımındaki
  ağ hatası login veya Premium erişimini bozmaz; çevrimiçi olduğunda yeniden
  denenir.

## Teknoloji

- Expo SDK 54
- React Native 0.81
- React 19
- TypeScript
- Jest
- EAS Build / Submit
- react-native-google-mobile-ads

## Kurulum

```bash
npm install
```

## Lokal Çalıştırma

Metro bundler:

```bash
npm start
```

iOS simulator:

```bash
npm run ios
```

iOS gerçek cihaz native development build:

```bash
npm run ios:device
```

Android emulator veya bağlı cihaz:

```bash
npm run android
```

Android build için Java/JDK kurulu olmalıdır.

## Test ve Kontroller

Typecheck:

```bash
npm run typecheck
```

CI testleri:

```bash
npm run test:ci
```

Expo lint:

```bash
npm run lint
```

Sık kullanılan component lint kontrolü:

```bash
npx eslint components/LoanCalculator.js components/LoanResult.js
```

## Reklam Test Notları

Development / simulator ortamında Google test interstitial ad unit ID kullanılır.

Production ortamında iOS ve Android için production AdMob ID'leri kullanılır. Production reklamlarla yoğun manuel test yapılmamalıdır.

Reklam akışı PDF ve paylaşım aksiyonlarını bloklamamalıdır:

- Reklam hazırsa gösterilir.
- Reklam kapatılınca asıl PDF/paylaşım aksiyonu devam eder.
- Reklam hazır değilse aksiyon direkt devam eder.
- Reklam gösterimi fail olursa kullanıcı aksiyonu kaybolmaz.

## EAS Build

Android production build:

```bash
eas build --platform android --profile production
```

iOS production build:

```bash
eas build --platform ios --profile production
```

Android son build submit:

```bash
eas submit --platform android --latest
```

iOS son build submit:

```bash
eas submit --platform ios --latest
```

Not: `eas.json` içinde production build için `autoIncrement` açıktır ve `appVersionSource` remote olarak ayarlanmıştır. EAS, store build numaralarını remote version bilgisine göre artırabilir.

## Android Force Update Release Prosedürü

`force-update.json` repoda tutulur ve **her Android production sürümünde mutlaka kontrol edilip güncellenmelidir**. Lokal `android/app/build.gradle` değeri yerine EAS production build sonucunda görünen gerçek `versionCode` esas alınmalıdır.

Her Android release için:

1. Production AAB build'ini oluştur ve EAS'in verdiği gerçek `versionCode` değerini not al.
2. Build'i Google Play'e gönder ve yeni sürümün kullanıcılar tarafından indirilebilir olduğunu doğrula.
3. `force-update.json` içindeki `latestVersionCode` değerini her seferinde yeni production `versionCode` ile güncelle.
4. Eski sürümleri zorunlu olarak kapatmak isteniyorsa `minimumVersionCode` değerini desteklenen en düşük build numarasına yükselt.
5. Force update kullanılmayacaksa `enabled` değerini `false` yap; kullanılacaksa `true` bırak.
6. JSON değişikliğini commit edip `main` branch'ine pushla.

Örnek:

```json
{
  "android": {
    "enabled": true,
    "minimumVersionCode": 18,
    "latestVersionCode": 18,
    "storeUrl": "https://play.google.com/store/apps/details?id=com.xewor.bankacikredihesaplama",
    "message": "Bankacı'yı kullanmaya devam etmek için uygulamanızı güncelleyin."
  }
}
```

Yeni sürüm Google Play'de erişilebilir olmadan `minimumVersionCode` yükseltilmemelidir. Aksi durumda kullanıcı güncelleyebileceği bir sürüm bulunmadan uygulamada kilitlenebilir.

Uygulama yapılandırmayı public `raw.githubusercontent.com` adresinden okur. Repo private yapılacaksa önce `force-update.json` herkese açık kalıcı bir adrese taşınmalı ve `src/update/forceUpdateService.ts` içindeki URL güncellenmelidir.

## Sürüm Bilgisi

Mevcut uygulama sürümü:

- App version: `3.1.0`
- Android package: `com.xewor.bankacikredihesaplama`
- iOS bundle identifier: `com.xewor.bankacikredihesaplama`

## Proje Yapısı

- `TODO.md`: release doğrulamaları ve ürün geliştirme yol haritası
- `components/LoanCalculator.js`: ana form, geçmiş, PDF/paylaşım aksiyonları
- `components/LoanResult.js`: sonuç ekranı ve ödeme planı görünümü
- `src/domain/loan/calculateLoan.ts`: hesaplama motoru
- `src/domain/loan/*Summary.ts`: plan tipi özetleri
- `src/pdf/createLoanPdfHtml.ts`: PDF HTML üretimi
- `src/storage/calculatorStorage.ts`: form, geçmiş ve PDF tercihleri saklama
- `src/ads/*`: AdMob config ve interstitial akışı

## Release Öncesi Önerilen Kontrol

```bash
npm run typecheck
npm run test:ci
npx eslint components/LoanCalculator.js components/LoanResult.js
```

Ardından gerçek cihazda en az şu akışlar manuel kontrol edilmelidir:

- Standart sabit taksitli hesaplama
- Peşin faiz ödemeli hesaplama
- Eşit anapara hesaplama
- Özel / balon ödeme hesaplama
- Anapara ödemesiz dönemli hesaplama
- Artan taksitli hesaplama
- PDF oluşturma
- Paylaşım
- Geçmişten hesaplama açma
- Reklam hazır / hazır değil senaryoları
- Android production `versionCode` ile `force-update.json` kontrolü
