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
| Form analizi | MediaPipe Pose Landmarker; web'de tarayıcıda, telefonda uygulamanın içindeki web görünümünde (`react-native-webview`) | Expo Go özel yerel modül çalıştırmaz; web görünümü Expo Go'da da çalışır. Kurallar `shared/pose.ts` içinde, iki taraf aynı kodu kullanır |
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
| 5 (sprint 5) | `member_activations` (tek kullanımlık etkinleştirme kodu), `member_consents` (KVKK rızası, yalnızca eklenebilir), `members.activated_at`, `members.session_epoch` |
| 6 (sprint 6) | `members.role` (üye / eğitmen), `members.trainer_id`, `member_programs.assigned_by`; `membership_events.created_by` yalnızca otomatik dondurma bitişinde boş olabilir |

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

### Sprint 5: yeni üye kaydı (bitti, 2026-11-10)

Salona ilk kez gelen kişi resepsiyonda kaydedilir, KVKK rızası alınır, ilk paketi satılır ve aynı dakika içinde telefonundan uygulamaya girip kapıdan geçer. Hesabı her zaman resepsiyon açar; üye şifresini kendisi belirler, şifre görevlinin elinden geçmez.

**Akış**

1. Resepsiyon "Yeni üye": ad soyad, telefon (zorunlu); doğum yılı, cinsiyet, boy, kilo, hedef (isteğe bağlı).
2. KVKK: aydınlatma metni okundu onayı zorunlu. İsteğe bağlı veriler (doğum yılı, cinsiyet, boy, kilo, hedef) yalnızca ayrı açık rıza verilirse kaydedilir; rıza yoksa sunucu bu alanları reddeder (400), sessizce atmaz.
3. İlk paket (isteğe bağlı, mevcut satış kuralıyla aynı): paket ve ödeme türü. Hesap ve satış tek işlemde (transaction) yazılır; biri başarısızsa hiçbiri yazılmaz.
4. Ekranda büyük harflerle 6 haneli etkinleştirme kodu ve geri sayım (15 dk). Kod yalnızca bu yanıtta bir kez döner, sunucuda scrypt ile özetlenmiş saklanır, loglanmaz.
5. Üye uygulamada "İlk kez mi giriyorsun?": telefon + kod + yeni şifre (iki kez, en az 8 karakter). Doğruysa oturum açılır, QR anahtarı gelir, ana sayfa üyelik kartıyla açılır.
6. Resepsiyon ekranında üye kartı canlı olayla "Uygulamaya girdi" olur.

**Kurallar**

| Kural | Değer |
|---|---|
| Kod | 6 hane, `crypto.randomInt`, 15 dk geçerli, tek kullanımlık |
| Yanlış deneme | Aynı koda 5 yanlış denemede kod geçersizleşir; resepsiyon yenisini verir |
| Kod yenileme | Üye kartında "Etkinleştirme kodu ver": eski kod anında geçersiz. Etkin hesapta da çalışır ve **şifre sıfırlama** yerine geçer (üye şifresini unutursa resepsiyona gelir); yeni şifre belirlenince eski oturumlar düşer |
| Etkinleşmemiş hesap | Şifre alanı kimsenin bilmediği rastgele bir özettir; normal giriş her zaman "Telefon veya şifre hatalı" alır, kayıtlı ama etkinleşmemiş numara dışarıdan ayırt edilemez. Giriş ekranı hatadan sonra "Kodla etkinleştir" yolunu öne çıkarır. Kapı QR'ı üretilemez çünkü anahtar etkinleşmeden telefona gitmez |
| Telefon | Benzersiz; aynı numarayla ikinci kayıt 409 ve "Bu numarayla kayıtlı üye var" + mevcut üyeyi açma bağlantısı |
| Açık kayıt ucu | `POST /auth/member/register` kaldırılır (kimlik doğrulamasız, hiçbir ekran kullanmıyor). Hesap yalnızca personel token'ıyla açılır |
| TCKN | Toplanmaz |
| Log | Yalnızca üye ve personel numarası; telefon, kod ve şifre hiçbir zaman |

**Oturum düşürme:** `members.session_epoch` tamsayısı JWT'ye `ep` olarak girer; şifre sıfırlanınca artar ve eski token'lar 401 alır. Sunucuda oturum tutulmaz, yalnızca üye satırındaki sayı karşılaştırılır.

**Sunucu**

- Göç 5: `member_activations` (üye, kod özeti, son geçerlilik, yanlış deneme sayısı, kullanıldı/iptal zamanı, veren personel; üye başına tek açık kod, kısmi `UNIQUE` index), `member_consents` (üye, tür `notice` | `optional_data`, metin sürümü, verildi/verilmedi, zaman, personel; tetikleyicilerle yalnızca eklenebilir), `members.activated_at`, `members.session_epoch`. Mevcut üyeler `activated_at = created_at` ile doldurulur.
- Etkinleşmemiş üyenin `password_hash` alanı rastgele 32 baytın özetidir (sütun `NOT NULL`, bilinen bir şifreye karşılık gelmez).
- `POST /staff/members`: kayıt + rıza + isteğe bağlı ilk satış, yanıtta üye detayı ve kod.
- `POST /staff/members/:id/activation`: yeni kod.
- `POST /auth/member/activate`: telefon + kod + şifre → `MemberLoginResponse`. Bilinmeyen telefon ve yanlış kod aynı hata ve aynı süre.
- Canlı olay `member` (kayıt, etkinleşme): resepsiyon listesi ve kartı yenilenir.
- `shared/consent.ts`: aydınlatma ve açık rıza metni, sürüm sabiti (`KVKK_NOTICE_VERSION`). Metin değişirse sürüm artar, eski rızalar eski sürümle kalır.

**Web (resepsiyon)**

- Arama kutusunun yanında "Yeni üye" düğmesi; adımlı panel: Bilgiler → KVKK → Paket → Kod.
- Telefon yazılırken mevcut üye eşleşirse uyarı ve "Üyeyi aç".
- Üye kartında "Uygulamaya girmedi" etiketi, "Etkinleştirme kodu ver" düğmesi, rıza geçmişi.
- İkili görünüm prova akışına "Yeni üye kaydet, telefondan etkinleştir, kapıdan geç" adımı.

**Mobil**

- Giriş ekranında "İlk kez mi giriyorsun? Kodla etkinleştir" bağlantısı → etkinleştirme ekranı (telefon, 6 haneli kod alanı, şifre ve tekrarı).
- Profilde "KVKK aydınlatma metni" ve verilen rızalar (salt okunur).

**Testler (88 → 105)**

- Kod: süre dolması, 5 yanlış denemede geçersizleşme, tek kullanım, yenisi verilince eskisinin ölmesi, bilinmeyen telefonla aynı hata.
- Kayıt: rızasız isteğe bağlı veri 400, tekrar telefon 409, satış hatasında hesabın da yazılmaması, yalnızca personel (üye token'ı 403, token'sız 401), `/auth/member/register` 404.
- Rıza tablosu güncellenemez ve silinemez.
- Etkinleşmemiş hesapla giriş reddi; şifre sıfırlamada eski token 401.
- Uçtan uca: kayıt → etkinleştirme → `/me` → QR kodu kapıdan geçer.

**Örnek veri:** mevcut üyeler etkin; bir kurgu üye "kayıt oldu, uygulamaya girmedi" durumunda gelir.

**Kapsam dışı:** SMS ile kod gönderme, üyenin uygulamadan kendi kendine şifre sıfırlaması, fotoğraf, sağlık beyanı formu. Rıza geri alma ürüne eklenmeyecek (kurucu kararı, 2026-11-10): rıza yalnızca kayıtta alınır ve değiştirilemez kayıt olarak kalır.

- [x] Göç 5, `shared/consent.ts`, sözleşme tipleri
- [x] Sunucu: kayıt, kod verme, etkinleştirme, oturum düşürme, açık kayıt ucunun kaldırılması + testler
- [x] Web: Yeni üye paneli, üye kartında kod ve etiket, prova adımı
- [x] Mobil: etkinleştirme ekranı, profilde KVKK
- [x] Örnek veri, README, CHANGELOG
- [ ] Gerçek telefonda kayıttan kapıya deneme (kurucu)

### Sprint 6: eğitmen, telefonda AI form, güvenlik ve eksik halkalar (kod bitti, 2026-11-10)

**Kurucu kararları (2026-11-10):** eğitmen yalnızca kendisine atanan üyeleri görür; gelişimi görür, program atar, AI Form ile çeker, salondakileri görür. Telefondaki AI Form Expo Go içinde çalışır. Ek olarak giriş deneme sınırı, profil düzenleme, dondurmanın kendiliğinden bitmesi. Rıza geri alma yok, push bildirimi yok.

**1. AI Form: beş hareket, web ve telefon**

| Hareket | Kamera | Ölçülen açı | Tekrar: alt / üst eşik | Yarım tekrar | Ek kontrol |
|---|---|---|---|---|---|
| Squat (var) | Yandan | Diz | 100° / 160° | 100°'ye inmedi | Gövde dikeyden 50° fazla eğik |
| Bench press (var) | Yandan, omuz hizası | Dirsek | 95° / 150°, kilit 165° | Göğse inmedi | Üstte kilit yok |
| Shoulder press | Karşıdan, göğüs hizası | İki dirseğin ortalaması | 95° / 150°, kilit 165° | Omuz hizasına inmedi | Üstte kilit yok |
| Biceps curl | Yandan | Dirsek (kapanarak kaldırılır) | 60° / 140°, tam açılma 155° | 60°'ye kadar kıvrılmadı | Altta kol açılmadı; dirsek öne kaydı (gövde ile üst kol arası 30°'den fazla); gövde sallandı (dikeyden 15°'den fazla) |
| Triceps pushdown | Yandan | Dirsek | 100° / 145°, kilit 160° | Eller göğüs hizasına gelmedi | Altta kol kilitlenmedi; dirsek öne kaydı (30°'den fazla) |

- `shared/pose.ts`: hareket tanımı veriye dönüşür (kaldırma yönü açılarak ya da kapanarak, kamera yönü, eşikler, kontroller, ekran metinleri). Curl'de kaldırma süresi kapanma fazından ölçülür. Kare kare analiz (açı, yumuşatma, sayaç) web ve telefonun birlikte kullandığı tek fonksiyona taşınır; web'deki kopya kalkar.
- Antrenman hareketi → form hareketi eşlemesi: `squat`, `goblet-squat` → squat; `bench-press` → bench; `ohp`, `db-shoulder-press` → shoulder press; `biceps-curl`, `hammer-curl` → curl; `triceps-pushdown` → pushdown.
- Telefon: yeni "AI Form" ekranı. Kamera ve MediaPipe modeli uygulamanın içindeki web görünümünde (`react-native-webview`, Expo Go'da var) telefonda çalışır; görüntü telefondan çıkmaz, kaydedilmez. Web görünümü uygulamaya yalnızca iskelet noktalarını iletir; tekrar sayımı ve uyarılar uygulamada `shared/pose.ts` ile. Ön ve arka kamera arasında geçiş (kendini çekme ya da eğitmenin üyesini çekmesi).
- Model ve MediaPipe çalışma dosyaları ilk açılışta internetten iner: jsDelivr'de web ile aynı sabit sürüm (1.1.1) ve Google'ın model dosyası.
- Girişler: Antrenman sekmesinde "AI Form" kartı; antrenman sırasında desteklenen harekette "Formunu kontrol et"; eğitmen uygulamasında ayrı sekme.
- İlk iş fizibilite denemesi: Expo Go'daki web görünümünde kamera açılıyor mu (güvenli bağlam, izin). Açılmazsa durup haber veririm.

**2. Eğitmen hesabı**

- Resepsiyondaki "Yeni üye" paneli "Yeni hesap" olur; ilk adımda **Üye / Eğitmen** seçilir. Eğitmen hesabını yalnızca salon sahibi PIN'i açar (gişe hesabında seçenek kapalı, sunucu 403). Eğitmende paket adımı ve isteğe bağlı bilgiler yok; KVKK adımında eğitmene özel kısa aydınlatma metni (üyelik metni çalışana uymaz), ayrı sürümle.
- Etkinleştirme aynı: 6 haneli kod, telefonda "Kodla etkinleştir". Uygulama girişte hesap türüne göre açılır.
- Üye kartında **Eğitmen** seçimi (atanmamış ya da eğitmen listesi). Eğitmen kartında atanmış üyeler, hesap durumu ve rızalar; paket bölümü yok, eğitmene paket satılmaz (409).
- Kapı: eğitmen üyelik aranmadan geçer; imza, süre, sıra ve anti-passback kontrolleri aynen. Kapı ekranında "Eğitmen" yazar.
- Eğitmen uygulaması (Üyelerim, AI Form, QR Geçiş, Profil):
  - Üyelerim: salondakiler en üstte ve canlı; her satırda program, bu haftaki antrenman sayısı, son antrenman.
  - Üye ayrıntısı: haftalık antrenman sayısı ve hacim, son antrenmanlar, hareket başına rekorlar, mevcut program ve sıradaki gün; "Program ata" (hazır kütüphaneden).
- Üye tarafı: Antrenman sekmesinde "Eğitmenin: Hakan K." ve eğitmenin atadığı programda "Eğitmenin atadı" etiketi; atama canlı olayla anında düşer. Üye programı yine kendisi değiştirebilir; eğitmenin atadığı programda önce onay sorulur, değişikliği eğitmen görür.
- Erişim: eğitmen yalnızca kendisine atanan üyenin verisini görür ve programını değiştirir, başkasınınki 404. Buddy radarı ve antrenman kaydı yalnızca üyeler içindir (eğitmen token'ı 403).

**3. Giriş deneme sınırı** (şu an 4 haneli personel PIN'i sınırsız denenebiliyor)

| Uç | Sınır | Sonra |
|---|---|---|
| Personel PIN girişi | Aynı cihazdan 15 dakikada 5 yanlış | 15 dakika 429 |
| Üye ve eğitmen girişi | Aynı telefona 15 dakikada 5 yanlış; aynı cihazdan 20 yanlış | 15 dakika 429 |
| Kodla etkinleştirme | Aynı cihazdan 15 dakikada 10 yanlış (kodun kendi 5 deneme hakkına ek) | 15 dakika 429 |

- 429 RFC 7807 biçiminde, `Retry-After` başlığıyla: "Çok fazla deneme. N dakika sonra tekrar dene." Başarılı giriş o telefonun sayacını sıfırlar. Cihaz, bağlantının IP adresidir (`X-Forwarded-For` okunmaz, araya vekil sunucu yok).
- Sayaçlar sunucu belleğinde, ek paket yok. Sunucu yeniden başlayınca sıfırlanır; tek sunucu için yeterli, birden çok sunucuda ortak bir depo (Redis) gerekir.

**4. Profil düzenleme**

- Üye profilde doğum yılı, cinsiyet, boy, kilo ve hedefini günceller; değerler kayıttakiyle aynı aralıklarda doğrulanır. Yalnızca açık rıza verdiyse: vermediyse düzenleme ekranında açık rıza metnini onaylayarak verebilir (kaydı üye kendisi yaptığı için personelsiz yazılır). Eğitmende bu bölüm yok.

**5. Dondurmanın kendiliğinden bitmesi**

- Dondurma hakkı dolduğu gün üyelik kendiliğinden aktif olur: hak kadar gün bitişe eklenir, önceden satılan yenileme de kayar (elle kaldırmayla aynı kural). Sunucu açılışta ve 10 dakikada bir tarar; kapı da okutulan üyeyi tarar, hakkı dolan üye kapıda takılmaz. İşlem geçmişine "Otomatik" diye yazılır, canlı olayla telefona ve resepsiyona düşer.

**Veri (göç 6)**

- `members.role` (`member` | `trainer`), `members.trainer_id` (yalnızca üyede; tetikleyici, gösterdiği hesabın eğitmen olduğunu doğrular), `member_programs.assigned_by`.
- `membership_events.created_by` yalnızca otomatik dondurma bitişinde boş olabilir (tablo yeniden kurulur, yalnızca-eklenebilir tetikleyiciler korunur).
- `members` tablosu artık uygulama hesaplarını (üye ve eğitmen) tutar. Yeniden adlandırma bilinçli olarak yapılmadı (her katmana dokunur); hesap türünü `role` ayırır.

**Örnek veri:** iki eğitmen, Hakan Koç (`5550001001`) ve Derya Aksoy (`5550001002`), demo şifresiyle. Demo üye Erdem Hakan'a atanmış, programı Hakan atamış görünür; her eğitmene yaklaşık 20 üye.

**Testler (105 → 125):** yeni hareketlerin sayımı ve uyarıları, ortak analiz fonksiyonu; eğitmen yetkileri (yalnızca salon sahibi açar, yalnızca kendi üyesi, üye uçları kapalı), kapıda üyeliksiz geçiş, eğitmene satış reddi; deneme sınırı ve süre dolunca açılma; profil düzenleme ve rıza; kendiliğinden çözme ve yenilemenin kayması.

**Riskler:** web görünümünde kamera Expo Go'da açılmazsa telefondaki AI Form için yerel derlemeye geçmek gerekir (ilk adımda denenecek). Emülatörün kamerası sanal bir oda gösterdiği için iskelet tespitini emülatörde doğrulayamam: tekrar sayımı testlerle doğrulanır, gerçek deneme senin telefonunda. Shoulder press karşıdan çekildiği için bel eğimi ölçülemez.

**Sıra:**
- [x] AI Form kuralları (beş hareket) ve web
- [x] Telefonda AI Form: ekran, web görünümü ve analiz yazıldı. Emülatörde model yüklendi (güvenli bağlam ve indirme çalışıyor); kamera isteği emülatörde yanıtsız kaldı, nedeni bulunmadan kurucu denemeyi kendi telefonunda yapmak üzere durdurdu
- [x] Eğitmen: göç 6, sunucu, testler
- [x] Eğitmen: resepsiyon
- [x] Eğitmen: uygulama ve üye tarafı (emülatörde ya da telefonda denenmedi)
- [x] Giriş deneme sınırı
- [x] Profil düzenleme (ekran denenmedi)
- [x] Dondurmanın kendiliğinden bitmesi
- [x] Örnek veri, README, CHANGELOG
- [ ] Gerçek telefonda AI Form kamerası, eğitmen akışı ve profil düzenleme (kurucu)

---

## 7. Kapsam dışı

Gerçek ödeme, mağaza yayını, sunucudan push bildirimi (kurucu: şimdilik gerek yok), grup dersi rezervasyonu, çoklu şube, internete açık sunucu, üyenin ya da eğitmenin programı sıfırdan kurması (hazır kütüphaneden seçilir ve atanır), eğitmenle mesajlaşma ve not, iade ve kısmi ödeme, rıza geri alma (kurucu kararı).
