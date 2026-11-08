# NOVRA GYM · Proje Planı

SAYNOVRA'nın vitrin ürünü: spor salonu için üye uygulaması, QR ile kapı geçişi, resepsiyon paneli, antrenman takibi, salon içi buddy radarı ve kamerayla form analizi.
Yalnızca yerelde çalışır (bilgisayar + aynı Wi-Fi'daki telefon). Yayına alınmaz, gerçek ödeme ve gerçek kişi verisi yoktur; demo üye dışındaki herkes kurgudur.

Görsel ve akış referansı: kurucunun taslağı (`novra_gym_ui_ux_prototipi_ve_canl_turnike_sim_lat_r.tsx`). Taslağın kodu taşınmaz, görünümü ve akışı korunur.

**Temel kural:** Vitrinde yalnızca gerçekten çalışan özellik olur. "Yapay zekâ", "imza", "röle" gibi bir iddia ekranda yazıyorsa arkasında o iş gerçekten yapılıyordur.

---

## 1. Marka

| Öğe | Değer |
|---|---|
| Ürün adı | NOVRA GYM ("Powered by SAYNOVRA") |
| Zemin | `#0A0D14` |
| Yüzey | `#12161F`, ikinci yüzey `#1A1F2B` |
| Vurgu (lime) | `#C8F031` |
| Onay | `#2EE59D` |
| Bilgi | `#4DB8FF` |
| Ret | `#FF5A4F` |
| Metin | `#EEF1F6` |
| Gri | `#7C849B` |
| Başlık | Space Grotesk 700 |
| Gövde | Inter |
| Etiket | JetBrains Mono, büyük harf |

Arayüz metinleri Türkçe; emoji ve uzun tire yok. Üye adları başka üyelere "Burak B." biçiminde gösterilir.

---

## 2. Mimari

```
Bilgisayar
├── server/   Node 24 + TypeScript, SQLite (node:sqlite), Hono, WebSocket (ws)     :3000
├── web/      Vite + React + Tailwind: kapı ekranı, resepsiyon, AI form, demo       :5173
└── shared/   contract.ts: API tipleri, QR kod biçimi, ret nedenleri (bağımlılıksız)

Telefon (aynı Wi-Fi, Expo Go)
└── mobile/   Expo + React Native + TypeScript (expo-router)
```

| Karar | Seçim | Gerekçe |
|---|---|---|
| Dil | Her yerde TypeScript | Tek dil; sözleşme `shared/contract.ts` içinde tek kaynak |
| Veritabanı | SQLite, `node:sqlite` | Tek dosya, ek paket ve kurulum yok |
| Canlı olaylar | WebSocket `/live` | Kapı, telefon ve panel aynı anda güncellenir |
| Şifre ve PIN | `node:crypto` scrypt | Ek paket yok |
| Oturum | JWT (HS256), sunucuda oturum tutulmaz | |
| Hata biçimi | RFC 7807 `application/problem+json` | |
| QR imzası | HMAC-SHA256; sunucuda `node:crypto`, telefonda `@noble/hashes` | İki uygulamanın aynı sonucu verdiği testle doğrulanır |
| QR okuma | Web: `getUserMedia` + `jsqr` (Windows Chrome'da `BarcodeDetector` yok) | |
| Form analizi | MediaPipe Pose Landmarker, tarayıcıda, laptop kamerası | Expo Go özel yerel modül çalıştırmaz; telefonda yapılmaz |
| Testler | `node --test` (yerleşik), gerçek SQLite (bellekte) | Sahte veritabanı yok |

Gerçek ürüne geçişte değişecekler: SQLite yerine PostgreSQL, sunucunun internete açılması (HTTPS, hız sınırı), personel hesapları, KVKK açık rıza akışı, gerçek turnike rölesi.

---

## 3. Kapı geçişi (QR)

Kod biçimi: `NG1.<üyeId>.<adım>.<i|o>.<imza>`

- `adım = floor(unix_saniye / 30)`; kod 30 saniyede bir değişir.
- `i` giriş, `o` çıkış. Telefon üyenin içeride olup olmadığını bilir, doğru yönün kodunu gösterir.
- `imza = HMAC-SHA256(üyenin qr_secret'ı, "<üyeId>.<adım>.<in|out>")` ilk 16 onaltılık karakter.
- Telefon kodu internetsiz üretir; anahtar giriş sırasında bir kez gelir ve güvenli depoda tutulur.

Sunucu sırayla kontrol eder, ilk başarısız adımda reddeder ve nedeni kaydeder:

| Sıra | Kontrol | Ret nedeni |
|---|---|---|
| 1 | Biçim | `invalid_format` |
| 2 | Üye var mı | `unknown_member` |
| 3 | İmza (sabit zamanlı karşılaştırma) | `bad_signature` |
| 4 | Adım ±1 içinde mi (en çok 90 sn) | `expired_code` |
| 5 | Aynı kod aynı yönde kullanıldı mı | `replayed` |
| 6 | Üyelik durumu | `no_membership`, `membership_frozen`, `membership_expired`, `membership_cancelled` |
| 7 | Anti-passback | `already_inside` (içerideyken giriş), `not_inside` (dışarıdayken çıkış) |

"İçeride" = son onaylı kayıt giriş ve 4 saatten yeni. Her deneme `checkins` tablosuna yazılır ve `/live` üzerinden panele ve üyenin telefonuna gider.

---

## 4. Özellikler: taslak ve gerçek karşılığı

| Özellik | Taslakta | Gerçekte |
|---|---|---|
| QR geçiş | Rastgele kareler | Bölüm 3 |
| Turnike | Buton simülasyonu | Laptop kamerası QR'ı okur, tam ekran onay/ret |
| Canlı doluluk | Sabit sayı | İçerideki üye sayısı / kapasite (85) |
| Saatlik yoğunluk "tahmini" | Elle yazılmış | Son 4 haftada aynı günün saatlik ortalaması; ekranda "geçmiş 4 haftaya göre" yazar |
| Ağırlık artışı önerisi | Sabit metin | Kural: son 2 antrenmanda tüm setler hedef tekrara ulaştı ve RPE ≤ 8 ise üst vücut +2,5 kg, alt vücut +5 kg. İki antrenman üst üste hedefin altında kaldıysa %10 hafifletme önerisi. Gerekçe metni veriden üretilir |
| Antrenman | Kaydetmiyor | Program, set/tekrar/kilo/RPE kaydı, 90 sn dinlenme sayacı, hacim, gelişim grafiği |
| Buddy / spotter radarı | Sabit liste | Yalnızca içeride olup ilan açan üyeler görünür; istek, kabul, kısa mesaj canlı. Çıkışta ilan kapanır. Tek telefonla deneme için örnek üyeler isteklere 2 sn içinde otomatik cevap verir |
| Salon içi akış | Sabit | Eşleşme ve ilan olaylarından canlı akış |
| AI form analizi | Animasyon | MediaPipe Pose: iskelet, dirsek/diz açısı, tekrar sayımı, hareket aralığı; laptop kamerasında |
| İkili görünüm | Var | `web` demo sayfası: kapı + resepsiyon yan yana |
| Resepsiyon | Yok | Üye arama, paket satışı, dondurma, iptal, günlük ciro |

---

## 5. Veri modeli

Zamanlar UTC ISO 8601 metin. Üyelik tarihleri İstanbul takvim günü (`YYYY-MM-DD`). Para kuruş cinsinden tam sayı. Kısıtlar veritabanında (`CHECK`, `UNIQUE`, yabancı anahtar). Şema sürümlü göçlerle kurulur (`PRAGMA user_version`).

| Göç | Tablolar |
|---|---|
| 1 (sprint 1) | `staff`, `members`, `plans`, `memberships`, `payments`, `checkins`, `gate_code_uses` |
| 2 (sprint 2) | `exercises`, `programs`, `program_days`, `program_items`, `workouts`, `workout_sets` |
| 3 (sprint 3) | `spotter_posts`, `spot_requests`, `spot_messages` |

Üyelik durum makinesi (tek fonksiyon, izin tablosu):

```
active ──dondur──► frozen ──çöz──► active
active ──süre biter──► expired        active | frozen ──iptal──► cancelled
```

---

## 6. Sprintler

### Sprint 1: kapı
- [ ] `shared/contract.ts`, sunucu iskeleti, ayar doğrulama, hata biçimi
- [ ] Göç 1, örnek veri (40 kurgu üye, 4 paket, son 28 günün girişleri)
- [ ] Üye ve personel girişi (JWT)
- [ ] QR kod üretme/doğrulama, kapı kuralları, `/live`
- [ ] Web: PIN girişi, kapı ekranı (kamera + elle kod), canlı geçiş kayıtları, doluluk
- [ ] Mobil: giriş, ana sayfa (üyelik kartı, içeride/dışarıda, doluluk), QR ekranı, profil
- **Bitti ölçütü:** Telefondaki QR laptop kamerasına tutulunca yeşil ekran; telefonda "Kapı açıldı"; aynı kodun ekran görüntüsü 90 sn sonra reddediliyor; `npm test` yeşil.

### Sprint 2: antrenman
- [ ] Göç 2, 60 hareketlik kütüphane, demo üyeye 4 haftalık geçmiş
- [ ] Program oluşturma, antrenman ekranı (taslaktaki set tablosu), dinlenme sayacı
- [ ] Ağırlık önerisi kuralı + testleri, gelişim grafiği

### Sprint 3: salon zekâsı ve buddy
- [ ] Saatlik yoğunluk, ana sayfadaki doluluk kartı
- [ ] Spotter ilanı, istek/kabul, mesaj, otomatik cevap veren örnek üyeler
- [ ] Salon içi canlı akış

### Sprint 4: resepsiyon, AI form, demo
- [ ] Resepsiyon: üyeler, satış, dondurma, iptal, günlük özet
- [ ] AI form analizi (bench press, squat)
- [ ] İkili demo sayfası, çekim provası

---

## 7. Kapsam dışı

Gerçek ödeme, mağaza yayını, sunucudan push bildirimi, grup dersi rezervasyonu, eğitmen hesabı, çoklu şube, internete açık sunucu, telefonda form analizi.
