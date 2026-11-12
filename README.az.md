# SDGoku

**Dil:** [Русский](README.md) · [English](README.en.md) · Azərbaycanca

Rəqəmlərin yerinə 17 Dayanıqlı İnkişaf Məqsədinin (DİM) nişanları olan sudoku. Hər oyunda 17 məqsəddən təsadüfi seçilmiş 9-u iştirak edir.

Versiya 0.1.0. İnterfeys dilləri: rus, ingilis, Azərbaycan.

## Artıq nə işləyir

- Yeganə həlli olan tapmaca generatoru, 4 çətinlik səviyyəsi (45 / 36 / 30 / 25 açıq xana).
- Günün tapmacası: hamı üçün eynidir, tarixdən asılıdır; ardıcıl günlər seriyası.
- Qeydlər, gedişi geri almaq, silmək, hər oyunda 3 ipucu, 3 səhv limiti, taymer və fasilə.
- Cari oyunun və irəliləyişin cihazda avtomatik yadda saxlanması.
- Statistika, 13 nailiyyət, şəxsi rekordlar, məqsədlər haqqında kartlar.
- Səs və vibrasiya (ayarlarda söndürülür), sistem ayarına uyğun açıq və tünd mövzu.
- Server modulu (Firebase): e-poçtla giriş, irəliləyişin cihazlar arasında sinxronlaşdırılması, ümumi reytinq, hesabın silinməsi. **Konfiqurasiya verilənədək söndürülüb** («Server» bölməsinə baxın).

## Struktur

```
www/                  hazır veb-tətbiq, yığıcı lazım deyil
  index.html
  css/app.css         tərtibat və məqsəd nişanlarının qoşulması
  js/config.js        versiya və Firebase konfiqurasiyası
  js/engine.js        sudoku generatoru və həlledicisi
  js/store.js         yadda saxlama, statistika, rekordlar, nailiyyətlər
  js/cloud.js         Firebase: giriş, sinxronlaşdırma, reytinq
  js/audio.js         səslər və vibrasiya
  js/app.js           interfeys və oyun məntiqi
  js/i18n/*.js        tərcümələr və məqsədlər haqqında mətnlər (ru, en, az)
  assets/sdg/         17 məqsəd nişanı: goal-01.png … goal-17.png
  assets/fonts/       Oswald şrifti (OFL lisenziyası içindədir)
  vendor/             Firebase SDK 13.3.0 (compat), yalnız konfiqurasiya veriləndə yüklənir
firebase/firestore.rules   bazanın təhlükəsizlik qaydaları
tools/build-single.mjs     bir HTML faylına yığma (keçidlə göstərmək üçün)
tests/                     avtomatik testlər
capacitor.config.json      Android və iOS örtüyünün ayarları
```

## Brauzerdə baxmaq

```
npm run serve        # http://localhost:8080
```

## Android və iOS üçün yığma (Capacitor)

Node.js 20+, Android Studio, iOS üçün isə Xcode quraşdırılmış Mac (və ya bulud yığması, məsələn Codemagic və ya Ionic Appflow) lazımdır.

1. `capacitor.config.json` faylında `appId` dəyərini özünüzünkü ilə əvəz edin, məsələn `az.teskilatiniz.sdgoku`. Tətbiq dərc edildikdən sonra identifikatoru dəyişmək olmur.
2. Asılılıqları quraşdırın və platformaları əlavə edin:
   ```
   npm install
   npx cap add android
   npx cap add ios        # yalnız Mac-də
   npx cap sync
   ```
3. Android: `npx cap open android`, sonra Build → Generate Signed App Bundle (Google Play üçün .aab faylı).
4. iOS: `npx cap open ios`, sonra Xcode-da Product → Archive.
5. `www/` qovluğundakı hər dəyişiklikdən sonra `npx cap sync` icra edin. `android/` və `ios/` qovluqlarını yaradıldıqdan sonra repozitoriyaya əlavə edin: native layihələrin ayarları onlarda saxlanılır.
6. Tətbiqin nişanı və açılış ekranı: loqo hazır olanda `assets/icon.png` (1024×1024) faylını yerləşdirin və ölçüləri `@capacitor/assets` paketi ilə yaradın.

Android-də «Geri» düyməsi artıq işlənir (`@capacitor/app` plagini).

## Server: e-poçtla giriş, sinxronlaşdırma, ümumi reytinq

1. Firebase konsolunda layihə yaradın və ona veb-tətbiq əlavə edin.
2. Authentication → Sign-in method → Email/Password-u aktiv edin.
3. Firestore Database yaradın və `firebase/firestore.rules` faylındakı qaydaları yapışdırın.
4. Veb-tətbiqin konfiqurasiyasını `www/js/config.js` faylında `firebase: null` yerinə köçürün.
5. Yoxlayın: Ayarlar → Hesab → «E-poçtla daxil ol»; qələbədən sonra nəticə «Rekordlar → Ümumi reytinq» bölməsində görünür.

Məlumatların quruluşu:

- `users/{uid}`: oyunçunun irəliləyişi (statistika, rekordlar, nailiyyətlər, günlər seriyası). Giriş zamanı cihazdakı və serverdəki irəliləyiş birləşdirilir, heç nə itmir.
- `leaderboards/{lövhə}/scores/{uid}`: oyunçunun lövhədəki ən yaxşı nəticəsi. Lövhələr: `easy`, `medium`, `hard`, `expert`, `daily-İİİİ-AA-GG`.

Bilmək vacibdir:

- Nəticəni klient hesablayır, ona görə inadkar adam rekordu saxtalaşdıra bilər. Bazanın qaydaları yalnız açıq-aşkar mümkün olmayan dəyərləri rədd edir. Reytinq vacib olarsa, yoxlamanı serverə (Cloud Functions) köçürmək lazımdır.
- iOS-da tətbiq açılarkən giriş «ilişirsə», konfiqurasiyadan `authDomain`-i silin: e-poçtla giriş üçün o lazım deyil, Capacitor örtüyündə isə onun yüklənməsi bəzən mane olur. Ehtiyat variant: `@capacitor-firebase/authentication` plagini.
- Hesabsız irəliləyiş örtüyün `localStorage`-ində saxlanılır. iOS-da etibarlılıq üçün onu `@capacitor/preferences`-ə köçürmək məsləhətdir (dəyişdiriləcək yer: `js/store.js` faylındakı `read` və `write` funksiyaları).

## DİM nişanları və BMT qaydaları

- Hazırda `www/assets/sdg/` qovluğunda bizə göndərilmiş posterdən kəsilmiş nişanlar var (təxminən 160 px). **Dərc etməzdən əvvəl onları rəsmi nişanlarla əvəz edin**: BMT materialları səhifəsindəki E-SDG-Icons-WEB arxivi: https://www.un.org/sustainabledevelopment/news/communications-material/ . Fayl adlarını olduğu kimi saxlayın.
- Nişanları yenidən çəkmək və dəyişdirmək olmaz.
- İstifadə qaydaları: https://www.un.org/sustainabledevelopment/wp-content/uploads/2023/09/E_SDG_Guidelines_Sep20238.pdf
  - Məlumatlandırma məqsədli qeyri-kommersiya istifadəsi üçün icazə tələb olunmur.
  - Reklam, ödənişli funksiyalar, vəsait toplanması: əvvəlcə BMT-nin yazılı icazəsi lazımdır (sorğu forması həmin səhifədədir).
  - BMT sisteminə daxil olmayan təşkilatlar loqonun BMT emblemli variantından istifadə edə bilməz və DİM-in rəngli çarxını və ya nişanlarını öz loqosu ilə birləşdirə bilməz. Bu, tətbiqin gələcək nişanına da aiddir.
  - BMT https://www.un.org/sustainabledevelopment keçidinin və materialın BMT tərəfindən təsdiqlənmədiyi barədə mətnin yerləşdirilməsini xahiş edir. Hazırda «Ayarlar → Tətbiq haqqında» bölməsində öz sözlərimizlə yazılmış mətn var (tərcümələrdə `about_text` açarı). Dərc etməzdən əvvəl oraya BMT materialları səhifəsindəki rəsmi mətni yerləşdirin.
- Hazırda plitələr interfeysin bütün dillərində ingiliscədir. Başqa dillərdəki dəstləri `css/app.css` faylında ayrıca qaydalarla qoşmaq olar, məsələn `html[lang="ru"] .g1 { background-image: … }`.

## Dərc üçün yoxlama siyahısı

Google Play:

- Tərtibatçı hesabı (ödənişli qeydiyyat). 13 noyabr 2023-cü ildən sonra yaradılmış şəxsi hesablar üçün buraxılışdan əvvəl qapalı test tələb olunur: ən azı 12 testçi, ardıcıl 14 gün. Təşkilat hesablarına bu tələb aid deyil. Ətraflı: https://support.google.com/googleplay/android-developer/answer/14151465
- Açıq keçidlə məxfilik siyasəti (tətbiq e-poçt ünvanını və oyun irəliləyişini toplayır).
- Data safety bölməsi: e-poçt ünvanı, istifadəçi identifikatoru, oyun irəliləyişi.
- Hesabın silinməsi: tətbiqdə artıq var (Ayarlar → Hesab), əlavə olaraq silinmə sorğusu üçün veb-keçid lazımdır.
- Yaş reytinqi, təsvir və üç dildə skrinşotlar.

App Store:

- Apple Developer Program üzvlüyü (illik ödənişli), Xcode olan Mac və ya bulud yığması.
- Məxfilik siyasəti və App Store Connect-də məxfilik «etiketləri».
- Tətbiqin daxilində hesabın silinməsi: var.

Mağazaların tələbləri dəyişir, göndərməzdən əvvəl aktual tələblərlə tutuşdurun.

## Testlər

```
npm test                                   # mühərrik: həllin yeganəliyi, səviyyələr, günün tapmacası
node tools/build-single.mjs                # dist/sdgoku.html faylını yığmaq
NODE_PATH=<playwright olan node_modules> node tests/ui.test.cjs      # telefon ölçülü brauzerdə tam oyun
NODE_PATH=<playwright olan node_modules> node tests/cloud.test.cjs   # saxta serverdə giriş, sinxronlaşdırma, reytinq
```

## Hələ yoxlanılmayıb

- Real cihazlarda Android və iOS yığmaları. Yalnız Capacitor layihəsinin yaradıldığı və `www/` qovluğunun ona köçürüldüyü yoxlanılıb.
- Həqiqi Firebase layihəsi ilə iş. Məntiq saxta serverdə yoxlanılıb, həqiqi SDK isə yüklənmə və oyunun çağırdığı bütün metodların mövcudluğu baxımından yoxlanılıb.
- Azərbaycan dilinə tərcüməni dil daşıyıcısı oxuyub düzəltməlidir (bu fayl da daxil olmaqla). 1–4-cü məqsədlərin adları azerbaijan.un.org ilə tutuşdurulub, qalanlarını da orada yoxlamaq lazımdır.

## Gələcək üçün ideyalar

- Yeni başlayanlar üçün 4×4 və 6×6 sahələr, keçmiş günün tapmacalarının arxivi.
- İnterfeys dilində məqsəd nişanları.
- Reytinq üçün nəticələrin serverdə yoxlanılması.
