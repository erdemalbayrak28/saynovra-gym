# Changelog

## 2026-11-09 · Sprint 2: antrenman

- Antrenman, kurucunun isteğiyle işaretleme listesi yerine programa göre çalışıyor: üye hazır programlardan birini seçer, uygulama sıradaki günü, hareketi, seti, kiloyu ve tekrarı söyler.
- Program kütüphanesi: Başlangıç Tüm Vücut, Hipertrofi Üst/Alt, Push/Pull/Legs, Güç 5x5, Kondisyon ve Yağ Yakımı (29 hareket, her biri kısa teknik ipucuyla).
- Yönlendirmeli antrenman ekranı: tek tuşla set kaydı, kilo ve tekrar için artı-eksi, otomatik dinlenme sayacı (+15 sn, atla, bitince titreşim), "son set nasıldı?" ile zorluk (RPE), hareket atlama, yarım kalan antrenmana kaldığı yerden devam, ekran kapanmaz. Akış bir durum makinesiyle yönetiliyor.
- Ağırlık önerisi kurala bağlı ve gerekçesiyle gösteriliyor: iki antrenman üst üste tüm setler tamamsa ağırlık artar, bir tanesi tamamsa "bir tane daha", iki kez aralığın altında kalırsa yaklaşık %10 hafifletilir; vücut ağırlığı hareketlerinde tekrar artar.
- Antrenman sonu özeti: süre, set, tekrar, hacim, yeni rekorlar, sıradaki gün. Program bir sonraki güne kendiliğinden geçer.
- Gelişim ekranı: son 6 haftanın antrenman sayısı ve hacmi, hareket başına en yüksek kilo (vücut ağırlığında tekrar) grafiği.
- Ana sayfaya "sıradaki antrenman" kartı, alt menüye "Antrenman" sekmesi eklendi.
- QR kodu her geçişte değişiyor (NG2 biçimi, son geçişin sıra numarası imzanın içinde): aynı 30 saniyede giriş, çıkış ve tekrar giriş artık çalışıyor; kullanılmış kodun ekran görüntüsü "Bu kod artık geçerli değil" ile reddediliyor. Tekrar kullanım tablosu kaldırıldı.
- Örnek veri: demo üyeye 4 haftalık antrenman geçmişi (16 antrenman, her öneri türü görünecek şekilde). Demo üyelerin QR anahtarları artık sabit; veriyi yenilemek telefondaki oturumu bozmuyor.
- Testler 27'den 50'ye çıktı: ağırlık önerisi kuralı ve antrenman akışı (program seçimi, devam etme, set doğrulama, bitirme, gelişim).

## 2026-11-09 · Sprint 1: kapı

- Plan, kurucunun taslağına göre güncellendi: ürün adı NOVRA GYM, renkler SAYNOVRA paleti, taslaktaki her özelliğin gerçek karşılığı ve 4 sprintlik sıra (`PLAN.md`).
- `shared/contract.ts`: sunucu, web ve mobilin ortak sözleşmesi. QR kod biçimi `NG1.<üye>.<adım>.<i|o>.<imza>`, ret nedenleri ve Türkçe metinleri, API tipleri.
- Sunucu (`server/`): Hono + SQLite. Sürümlü şema (personel, üye, paket, üyelik, ödeme, giriş kaydı, kod kullanım kaydı), ayarların açılışta doğrulanması, RFC 7807 hata biçimi, scrypt ile şifre/PIN, JWT oturum, `/live` WebSocket.
- QR kapı kuralları: imza (HMAC-SHA256, sabit zamanlı karşılaştırma), 90 saniyelik geçerlilik, tekrar kullanım engeli, üyelik durumu, giriş/çıkış anti-passback. Üyelik bitmiş olsa da içerideki üye çıkabilir. Her deneme kaydedilir.
- Üyelik durum makinesi (aktif, donmuş, süresi dolmuş, iptal) tek fonksiyonda.
- Örnek veri: 120 kurgu üye, 4 paket, son 28 günün akşam yoğunluklu giriş kayıtları, ödemeler.
- 27 test (`node --test`, bellekte gerçek SQLite): kod biçimi, telefon ile sunucunun aynı imzayı ürettiği, bütün ret nedenleri, HTTP akışı. Satır kapsamı %90,7.
- Web (`web/`): personel PIN girişi, laptop kamerasıyla QR okuma, büyük onay/ret paneli ve sesli uyarı, canlı doluluk ve günlük sayılar, canlı geçiş kayıtları, telefonsuz prova için test araçları.
- Mobil (`mobile/`, Expo SDK 58): telefon + şifre girişi (oturum anahtarlıkta saklanır), ana sayfa (üyelik kartı, içeride/dışarıda, canlı doluluk), 30 saniyede bir yenilenen imzalı QR (internetsiz üretilir, ekran parlaklığı en yükseğe çıkar), kapıdan geçince canlı "Kapı açıldı" kartı ve yön değişimi, profil.
- `baslat.cmd`: üç parçayı tek tıkla başlatır.
