# Changelog

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
