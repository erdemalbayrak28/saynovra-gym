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

Kod biçimi: `NG2.<üyeId>.<adım>.<i|o>.<sıra>.<imza>`

- `adım = floor(unix_saniye / 30)`; kod 30 saniyede bir değişir.
- `i` giriş, `o` çıkış. Telefon üyenin içeride olup olmadığını bilir, doğru yönün kodunu gösterir.
- `sıra` = üyenin son onaylı geçişinin kayıt numarası (hiç yoksa 0). Her geçişte değişir; böylece kullanılan kod ve ondan önceki bütün kodlar anında geçersizleşir, aynı 30 saniyede giriş, çıkış ve tekrar giriş de sorunsuz çalışır.
- `imza = HMAC-SHA256(üyenin qr_secret'ı, "<üyeId>.<adım>.<in|out>.<sıra>")` ilk 16 onaltılık karakter.
- Telefon kodu internetsiz üretir; anahtar giriş sırasında gelir ve güvenli depoda tutulur. Sıra numarası `/me` ve canlı olaylarla güncellenir.
- Anahtar değişirse (örnek verinin yenilenmesi) oturum açık kalır ama eski anahtarla imzalanan kodlar `bad_signature` alır. Bu yüzden `/me` anahtarın parmak izini verir: `HMAC-SHA256(qr_secret, "novra:qr-key-id")` ilk 16 karakter; anahtarı açık etmez, kod imzalayamaz. Telefon kendi anahtarının parmak izi farklıysa yeni anahtarı `/me/qr-key` ile alır, o ana kadar kod göstermez.

Sunucu sırayla kontrol eder, ilk başarısız adımda reddeder ve nedeni kaydeder:

| Sıra | Kontrol | Ret nedeni |
|---|---|---|
| 1 | Biçim | `invalid_format` |
| 2 | Üye var mı | `unknown_member` |
| 3 | İmza (sabit zamanlı karşılaştırma) | `bad_signature` |
| 4 | Adım ±1 içinde mi (en çok 90 sn) | `expired_code` |
| 5 | Kodun sıra numarası güncel mi (ekran görüntüsü, kullanılmış kod) | `stale_code` |
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
| Ağırlık artışı önerisi | Sabit metin | Kural (`server/src/domain/progression.ts`): son 2 antrenmanda aynı kiloyla tüm setler tekrar aralığının tepesine ulaştı ve ortalama RPE ≤ 8 ise üst vücut +2,5 kg, alt vücut +5 kg. Bir antrenman tuttuysa "bir tane daha" der. İki antrenman üst üste aralığın altında set varsa yaklaşık %10 hafifletir. Vücut ağırlığı hareketlerinde tekrar artırır. Gerekçe metni veriden üretilir |
| Antrenman | İşaretlenen set listesi | Kurucunun isteği: üye işaretlemez, programa göre çalışır. Hazır program kütüphanesinden seçim (5 program); uygulama sıradaki günü, hareketi, seti, kiloyu ve tekrarı söyler. Üye "Seti tamamladım"a basar, dinlenme sayacı kendiliğinden başlar, bitince titreşir ve sonraki seti açar. Farklı kilo/tekrar artı-eksiyle düzeltilir; isteğe bağlı "nasıldı?" (RPE). Yarım kalan antrenman kaldığı yerden sürer. Özet: süre, set, hacim, rekorlar. Gelişim: haftalık hacim, hareket başına en yüksek kilo grafiği |
| Buddy / spotter radarı | Sabit liste | Radar yalnızca salondaki üyelere açık; isimler "Burak B." biçiminde. İlan (kas grubu, sabit konum listesi, 140 karakter not), istek, kabul/ret/vazgeç, eşleşince iki tarafın ilanı kapanır, kısa mesajlaşma (hazır cevaplar). Biri çıkınca ilan kapanır, eşleşme ve sohbet biter. İstek durumları tek bir durum makinesinde (`server/src/domain/spot.ts`) |
| Salon içi akış | Sabit | Kapı ekranında ilan ve eşleşme olaylarından canlı akış |
| AI form analizi | Animasyon | Web "AI Form" sayfası, laptop kamerası ya da video dosyası. İskeleti MediaPipe Pose Landmarker (Google'ın sinir ağı modeli) tarayıcıda çıkarır; görüntü kaydedilmez, gönderilmez. Üstüne kurallar (`shared/pose.ts`): kameraya dönük tarafın diz (squat) ya da dirsek (bench) açısı, tekrar sayımı durum makinesiyle (üstte, iniyor, dipte), squat'ta 100°, bench'te 95° altına inmeyen tekrar "yarım" sayılır, squat'ta gövde dikeyden 50° fazla eğilirse uyarı, bench'te üstte 165° kilitleme, yavaşlama ilk tekrara göre kaldırma süresinden. Taslaktaki "bar hızı (m/s)" yok: kamerayla ölçeksiz metre ölçülemez, yerine süre ve yüzde yavaşlama var |
| İkili görünüm | Var | Web "İkili görünüm" sayfası: kapı ve resepsiyon yan yana, tek canlı bağlantı; katlanır "Prova akışı" adımları |
| Resepsiyon | Yok | Web "Resepsiyon" sayfası (`server/src/reception.ts`): ad veya telefonla arama (Türkçe harfsiz yazınca da bulur), "7 gün içinde bitenler" listesi, paket satışı (süren üyeliğin bitiminden sonra başlar, yoksa bugün), dondurma (paketin hakkı kadar; kaldırınca dondurulan günler bitişe eklenir, önceden satılan yenileme de kayar), iptal (yalnızca salon sahibi), bugünkü ciro ve ödeme türü dağılımı. Her işlem kimin yaptığıyla değiştirilemez geçmişe yazılır ve üyenin telefonuna anında düşer |

---

## 5. Veri modeli

Zamanlar UTC ISO 8601 metin. Üyelik tarihleri İstanbul takvim günü (`YYYY-MM-DD`). Para kuruş cinsinden tam sayı. Kısıtlar veritabanında (`CHECK`, `UNIQUE`, yabancı anahtar). Şema sürümlü göçlerle kurulur (`PRAGMA user_version`).

| Göç | Tablolar |
|---|---|
| 1 (sprint 1) | `staff`, `members`, `plans`, `memberships`, `payments`, `checkins`, `gate_code_uses` |
| 2 (sprint 2) | `exercises`, `programs`, `program_days`, `program_items`, `member_programs` (üye başına tek aktif program), `workouts` (üye başına tek aktif antrenman), `workout_sets`; `gate_code_uses` kaldırıldı (yerini sıra numarası aldı) |
| 3 (sprint 3) | `spotter_posts`, `spot_requests`, `spot_messages` |
| 4 (sprint 4) | `membership_events` (satış, dondurma, çözme, iptal; tetikleyicilerle yalnızca eklenebilir, güncellenemez ve silinemez), `memberships.modified_by` |

Üyelik durum makinesi (tek fonksiyon, izin tablosu):

```
active ──dondur──► frozen ──çöz──► active
active ──süre biter──► expired        active | frozen ──iptal──► cancelled
```

---

## 6. Sprintler

### Sprint 1: kapı (bitti, 2026-11-09)
- [x] `shared/contract.ts`, sunucu iskeleti, ayar doğrulama, hata biçimi
- [x] Göç 1, örnek veri (120 kurgu üye, 4 paket, son 28 günün girişleri)
- [x] Üye ve personel girişi (JWT)
- [x] QR kod üretme/doğrulama, kapı kuralları, `/live`
- [x] Web: PIN girişi, kapı ekranı (kamera + elle kod), canlı geçiş kayıtları, doluluk
- [x] Mobil: giriş, ana sayfa (üyelik kartı, içeride/dışarıda, doluluk), QR ekranı, profil
- **Bitti ölçütü:** Gerçek Android telefonla doğrulandı.

### Sprint 2: antrenman (bitti, 2026-11-09)
- [x] QR: sıra numaralı kod (NG2), tekrar kullanım tablosu kaldırıldı
- [x] Göç 2, 29 hareket ve 5 programlık kütüphane, demo üyeye 4 haftalık geçmiş (her öneri türü görünsün diye kurgulandı)
- [x] Program seçimi ve değiştirme, yönlendirmeli antrenman (durum makinesi `mobile/src/lib/workout-flow.ts`), dinlenme sayacı, devam etme, özet
- [x] Ağırlık önerisi kuralı + testleri, gelişim ekranı
- [ ] Gerçek telefonda deneme (kurucu)

### Sprint 3: salon zekâsı ve buddy (bitti, 2026-11-09)
- [x] Saatlik yoğunluk (son 4 haftada aynı gün, giriş kayıtlarından), ana sayfadaki doluluk kartı ve "kalan saatlerde en sakin" önerisi
- [x] Spotter ilanı, istek/kabul/ret/vazgeç, eşleşme, mesajlaşma, çıkışta kapanma; Buddy sekmesi ve bildirim noktası
- [x] Salon içi canlı akış (kapı ekranı)
- [x] Demo modu: kurgu üyeler girip çıkar, dört buddy ilan açar ve cevap verir (aşağıda)
- [x] Örnek veri 486 üyeye çıktı (akşam zirvesi yaklaşık %40); gelecekte başlayan üyelik hatası düzeltildi
- [ ] Gerçek telefonda deneme (kurucu)

**Demo modu** (`server/.env`: `DEMO_SIMULATION=true`, `DEMO_MIN_INSIDE=12`): yalnızca prova ve çekim içindir, varsayılan kapalıdır. Kurgu üyeler doluluğu o saatin geçmiş ortalamasına doğru götürür ve salonda en az 12 kişi tutar. Taslaktaki Burak, Kerem, Caner ve Emre spotter ilanı açar, isteklere birkaç saniyede cevap verir, sohbette birkaç kez yazar. Demo üye ilan açarsa 15 saniye sonra biri istek gönderir. Demo üyeyi hiçbir zaman hareket ettirmez. Bu kurgu davranışı yapan üyeler (5550000002-05), ikinci bir telefonla giriş yapılsa da otomatik davranmaya devam eder.

### Sprint 4: resepsiyon, AI form, demo (bitti, 2026-11-09)
- [x] Resepsiyon: arama, bitenler listesi, satış ve yenileme, dondurma ve çözme, iptal (salon sahibi), günlük ciro, değiştirilemez işlem geçmişi (göç 4)
- [x] Üyelik değişikliği canlı olay (`membership`): telefon kartı ve kapı aynı anda güncellenir
- [x] AI form analizi (squat, bench press): MediaPipe Pose tarayıcıda, kamera veya video dosyası, kurallar `shared/pose.ts` içinde ve testli
- [x] Web: üst menü (Kapı, Resepsiyon, AI Form, İkili görünüm), tek canlı bağlantı, ikili görünüm ve prova akışı
- [x] Örnek veri: üyeler resepsiyondan geçmiş gibi işlem geçmişiyle gelir, bugün birkaç yenileme satılmış olur
- [ ] Gerçek kamerada AI form denemesi ve çekim provası (kurucu)

---

## 7. Kapsam dışı

Gerçek ödeme, mağaza yayını, sunucudan push bildirimi, grup dersi rezervasyonu, eğitmen hesabı, çoklu şube, internete açık sunucu, telefonda form analizi, üyenin kendi programını sıfırdan kurması (kurucu hazır program seçimini istedi; eğitmenin üyeye program ataması sonraki aşamada), yeni üye kayıt ekranı (sunucuda kayıt ucu var; resepsiyon ve uygulama ekranı sonraki aşamada), iade ve kısmi ödeme, dondurma hakkı bitince kendiliğinden çözme.
