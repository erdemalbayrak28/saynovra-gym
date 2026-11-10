# NOVRA GYM

SAYNOVRA'nın vitrin projesi: spor salonu için üye uygulaması, QR ile kapı geçişi ve canlı geçiş kayıtları.
Yalnızca yerelde çalışır: bilgisayar ve aynı Wi-Fi'daki telefon. Plan ve kararlar: [PLAN.md](PLAN.md).

| Klasör | Ne | Teknoloji |
|---|---|---|
| `server/` | API, veritabanı, QR doğrulama, canlı olaylar | Node 24, Hono, SQLite (`node:sqlite`), WebSocket |
| `web/` | Personel ekranları: kapı (kamera ile QR okuma), resepsiyon, AI form analizi, ikili görünüm | Vite, React, Tailwind, MediaPipe |
| `mobile/` | Üye uygulaması (giriş, ana sayfa, QR, antrenman, gelişim, buddy radarı, sohbet, profil) | Expo SDK 58, expo-router |
| `shared/` | Ortak sözleşme (API tipleri, QR kod biçimi, ret nedenleri) ve form analizi kuralları | Bağımlılıksız TypeScript |

## Çalıştırma

`baslat.cmd` dosyasına çift tıklayın. Üç pencere açılır (sunucu, kapı ekranı, Expo) ve kapı ekranı tarayıcıda açılır.

Elle başlatmak için üç ayrı terminalde:

```powershell
cd server; npm run dev
```

```powershell
cd web; npm run dev
```

```powershell
cd mobile; npx expo start
```

### Telefonda açmak
1. Telefona **Expo Go** uygulamasını kurun (App Store / Google Play). "SDK uyumsuz" uyarısı çıkarsa uygulamayı güncelleyin.
2. Telefon ve bilgisayar aynı Wi-Fi ağında olsun.
3. Expo penceresindeki QR kodunu okutun: Android'de Expo Go içinden, iPhone'da Kamera uygulamasıyla.
4. Giriş ekranında "Demo hesabını doldur", sonra "Giriş yap".

### Kapıdan geçmek
1. Kapı ekranında (`http://localhost:5173`) personel PIN'i ile girin ve kamera iznini verin. Kamera yalnızca `localhost` adresinde çalışır.
2. Telefonda "QR Geçiş" sekmesini açın, ekranı laptop kamerasına tutun.
3. Kapı ekranı yeşil yanar, telefonda "Kapı açıldı" kartı çıkar, kayıt listeye düşer. Telefon bundan sonra çıkış kodunu gösterir.

Telefonsuz prova: kapı ekranındaki "Test araçları" ile kod yapıştırılabilir veya sahte imzalı kod denenebilir.

### Antrenman
1. Telefonda "Antrenman" sekmesi: demo üye "Hipertrofi: Üst / Alt" programında, 4 haftalık geçmişi var.
2. "Antrenmana başla": uygulama hareketi, seti, önerilen kiloyu ve tekrarı gösterir. Seti yapınca "Seti tamamladım", dinlenme sayacı kendiliğinden başlar.
3. Bitirince özet çıkar, program sonraki güne geçer. "Gelişimim" haftalık hacmi ve kilo grafiğini gösterir; "Değiştir" ile başka bir program seçilir.

### Buddy radarı
1. Önce kapıdan giriş yap: radar yalnızca salondakilere açık.
2. "Buddy" sekmesinde spotter arayanları gör, "Spot isteği gönder". Kabul edilince "Mesajlar" açılır.
3. Kendin de ilan açabilirsin. Kapıdan çıkınca ilan ve eşleşmeler kendiliğinden kapanır.

### Resepsiyon
1. Kapı ekranında üst menüden "Resepsiyon". İptal için salon sahibi PIN'iyle girin; gişe PIN'i satış ve dondurma yapabilir, iptal edemez.
2. Ad, soyad veya telefonla arayın; arama boşken bu hafta üyeliği bitecekler listelenir.
3. Üyeyi seçin: "Paket sat" (paket ve ödeme türü), "Dondur" / "Dondurmayı kaldır", "İptal et". Her işlem "İşlem geçmişi"ne yazılır ve üyenin telefonuna anında düşer.

### AI form analizi
1. Üst menüden "AI Form". Hareketi seçin (Squat, Bench press), "Kamerayı başlat" deyin ya da "Video dosyası" ile telefonla çektiğiniz bir seti açın.
2. Squat için kamera yanda, baştan ayağa tüm vücut kadrajda (2-3 metre). Bench için kamera sehpanın yanında, omuz hizasında.
3. Ekranda iskelet ve ölçülen açı, tekrar sayısı, yarım tekrarlar, en dip açı, kaldırma süresi ve yavaşlama görünür. "Sıfırla" yeni seti başlatır.

Model (`pose_landmarker_lite.task`, yaklaşık 6 MB) ilk açılışta Google'ın sunucusundan iner, tarayıcı saklar. İnternetsiz bir yerde çalışmak için bu dosyayı bir kez [buradan](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task) indirip `web\public\mediapipe\` klasörüne koyun; sayfa önce oraya bakar. Kamera görüntüsü bilgisayardan çıkmaz.

### İkili görünüm ve çekim provası
Üst menüden "İkili görünüm": kapı solda, resepsiyon sağda. Sayfanın üstündeki "Prova akışı" adım adım senaryoyu gösterir (QR ile giriş, dondur, kapının reddi, dondurmayı kaldır, süresi biten üyeye satış). Geniş ekranda (1600 piksel ve üstü) en iyi görünür.

### Demo modu
`server\.env` içinde `DEMO_SIMULATION=true` olursa sunucu kurgu bir salon hareketi üretir: üyeler kapıdan girip çıkar (salonda en az `DEMO_MIN_INSIDE` kişi), Burak, Kerem, Caner ve Emre spotter ilanı açar, isteklere ve mesajlara birkaç saniyede cevap verir; sen ilan açarsan biri sana istek gönderir. Prova ve çekim içindir; `false` yapınca kapanır.

## Demo hesapları

Yalnızca yerel örnek veritabanı içindir.

| Hesap | Bilgi |
|---|---|
| Demo üye (Erdem Albayrak) | Telefon `5550000001`, şifre `novra2026` |
| Diğer 485 kurgu üye | Telefon `5550000002` ile `5550000486` arası, aynı şifre |
| Personel: Salon Sahibi | PIN `1907` |
| Personel: Gişe | PIN `2024` |

## Örnek veriyi sıfırlamak

"Şu an içeride" sayısı örnek veri oluşturulduğu saate göre hesaplanır. Çekim veya demo öncesinde sunucuyu kapatıp yeniden oluşturun:

```powershell
cd server; npm run seed
```

## İlk kurulum (başka bir bilgisayarda)

Gereken: Node.js 24 veya üstü.

```powershell
cd server; npm install; copy .env.example .env
```

`server\.env` içindeki `JWT_SECRET` değerini doldurun (en az 32 karakter, üretmek için dosyadaki komut). Sonra:

```powershell
cd server; npm run seed
```

```powershell
cd web; npm install
```

```powershell
cd mobile; npm install
```

## Kontroller

```powershell
cd server; npm test; npm run typecheck
```

```powershell
cd web; npm run typecheck
```

```powershell
cd mobile; npx tsc --noEmit; npx expo lint
```

## Sorun giderme

| Belirti | Çözüm |
|---|---|
| Telefonda "Sunucuya ulaşılamıyor" | Aynı Wi-Fi'da olun. Windows Güvenlik Duvarı'nda Node.js için "Özel ağlar" izni verin. |
| Kapı ekranında "Kamera bulunamadı" | Sayfayı `localhost` adresinden açın; başka bir program kamerayı kullanıyorsa kapatın. |
| QR okunmuyor | Telefon parlaklığı QR ekranında kendiliğinden en yükseğe çıkar; telefonu kameraya 20-30 cm mesafede, düz tutun. |
| "Kodun süresi geçmiş" | Telefon ve bilgisayar saatleri otomatik ayarlı olmalı; aradaki fark 30 saniyeyi geçmemeli. |
| Kapı "Geçersiz kod" diyor | Telefondaki QR anahtarı eski (örnek veri yenilenmiş). Uygulama bunu açılışta kendiliğinden düzeltir, QR ekranında kısa süre "Kapı anahtarın yenileniyor" görünür. Sürerse Profil sekmesinden "Çıkış yap", sonra tekrar giriş yap. |
| Port kullanımda hatası | Önceki pencereleri kapatın; sunucu 3000, kapı ekranı 5173, Expo 8081 portunu kullanır. |
| AI Form'da "Kamera açılamadı" | Kamera aynı anda tek sekmede çalışır; kapı ekranı başka bir sekmede açıksa kapatın. |
| AI Form'da "Model yüklenemedi" | İnternet bağlantısını kontrol edin ya da modeli `web\public\mediapipe\` içine koyun (yukarıda). |
| Tekrar sayılmıyor | Ölçülen eklemler (squat: kalça, diz, ayak bileği; bench: omuz, dirsek, bilek) görünmüyorsa ekranda "Vücudun kadrajda tam görünmüyor" yazar. Kamerayı yana alın, ışığı artırın. |
