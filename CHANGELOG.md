# Changelog

## 2026-11-09 · Sprint 4: resepsiyon, AI form, ikili görünüm

- Resepsiyon (web, "Resepsiyon" sekmesi): ad, soyad veya telefonla üye arama; "sahin" yazınca "Şahin", "irmak" yazınca "Irmak" da bulunur, listeler Türkçe alfabe sırasında. Arama boşken "7 gün içinde bitenler" listesi (yenileme satılmışlar hariç).
- Paket satışı: süren üyeliği olan üyede yeni paket o üyeliğin bitiminden sonra başlar, yoksa bugün. Dondurulmuş üyeliğe satış yapılmaz. Ödeme türü (nakit, kart, havale) kaydedilir; gerçek ödeme alınmaz.
- Dondurma: paketin dondurma hakkı kadar (Aylık pakette yok). Kaldırınca dondurulan günler bitiş tarihine eklenir, önceden satılan yenileme de aynı gün kadar kayar; hak bittiyse fazlası eklenmez.
- İptal yalnızca salon sahibi PIN'iyle; gişe hesabında düğme kapalı, sunucu da 403 döner.
- Bugünkü ciro, satış adedi, ödeme türü dağılımı, aktif ve dondurulmuş üye, bu hafta bitecekler.
- İşlem geçmişi: her satış, dondurma, çözme ve iptal kimin yaptığıyla `membership_events` tablosuna yazılır; tetikleyiciler kaydın güncellenmesini ve silinmesini engeller. Üyeliklere `modified_by` eklendi (göç 4).
- Resepsiyondaki değişiklik canlı olayla anında üyenin telefonuna düşer: üyelik kartı "Dondurulmuş" olur (mavi, açıklamalı), kapı girişte "Üyelik dondurulmuş" der.
- AI form analizi (web, "AI Form" sekmesi): squat ve bench press, laptop kamerası ya da telefonla çekilmiş video dosyası. İskeleti Google'ın MediaPipe Pose modeli bu bilgisayarda çıkarır (GPU, kare başına yaklaşık 13 ms); görüntü kaydedilmez, gönderilmez. Ekranda iskelet ve ölçülen eklem açısı, tekrar sayısı, yarım tekrar, en dip açı, kaldırma süresi ve ilk tekrara göre yavaşlama; squat'ta gövde eğimi, bench'te üstte kilitleme uyarısı. Kurallar `shared/pose.ts` içinde, sabit eşiklerle.
- İkili görünüm: kapı ve resepsiyon yan yana, katlanır "Prova akışı" adımlarıyla. Web artık üst menülü (Kapı, Resepsiyon, AI Form, İkili görünüm) ve tüm paneller tek canlı bağlantıyı paylaşıyor.
- MediaPipe paketi 1.1.1 sürümüne sabitlendi (en yeni sürüm 6 günlüktü); çalışma dosyaları `npm run dev` öncesinde `web/public/mediapipe` altına kopyalanır. Model ilk açılışta Google'dan iner; dosya `web/public/mediapipe/` içine konursa internetsiz çalışır.
- Örnek veri: üyeler resepsiyondan geçmiş gibi satış, dondurma ve iptal geçmişiyle gelir; kayıt tarihi ilk paketin tarihi oldu; bugün birkaç yenileme satılmış olur.
- Testler 67'den 88'e çıktı: resepsiyon kuralları ve API'si (11), form analizi geometrisi ve tekrar sayımı (10).

## 2026-11-09 · Sprint 3: salon zekâsı ve buddy

- Buddy radarı (yeni "Buddy" sekmesi): salondaki üyeler spotter ilanı açar (kas grubu, salondaki yer, kısa not), diğerleri spot isteği gönderir, ilan sahibi kabul eder ya da reddeder, eşleşince iki tarafın ilanı kapanır ve kısa mesajlaşma açılır (hazır cevaplar). Biri kapıdan çıkınca ilan kapanır, eşleşme ve sohbet biter. Radar salon dışından görünmez; isimler "Burak B." biçiminde.
- Yeni istek, kabul ve mesajlar canlı geliyor; Buddy sekmesinde bildirim noktası yanıyor.
- Saatlik yoğunluk: son 4 haftada aynı günün gerçek giriş kayıtlarından saat saat ortalama doluluk. Ana sayfada grafik ve "bugün kalan saatlerde en sakin" önerisi.
- Ana sayfaya, salondayken "Salondaki buddy'ler" önizlemesi eklendi.
- Kapı ekranına "Salon içi akış": spotter ilanları ve eşleşmeler canlı.
- Alt menü beş sekme oldu, QR tam ortada.
- Demo modu (`DEMO_SIMULATION=true`, varsayılan kapalı): kurgu üyeler kapıdan girip çıkar, salonda en az 12 kişi tutulur, dört buddy ilan açıp isteklere ve mesajlara cevap verir, demo üye ilan açarsa biri istek gönderir.
- Örnek veri 486 kurgu üyeye çıktı (akşam zirvesi yaklaşık %40). Bazı üyeliklerin gelecekte başladığı bir hata düzeltildi.
- Kapı anahtarı kendini yeniliyor: örnek veri yenilenince üyenin anahtarı değişiyor ama telefondaki oturum açık kalıyordu, telefon eski anahtarla imzaladığı için kapı her kodu "Geçersiz kod" diye reddediyordu (kurucunun telefonunda yaşanan sorun). `/me` artık anahtarın parmak izini veriyor (anahtarı açık etmeyen bir HMAC), telefon farkı görünce yeni anahtarı `/me/qr-key` ile alıyor. Arada QR ekranı reddedilecek kod yerine "Kapı anahtarın yenileniyor" gösteriyor.
- Testler 50'den 67'ye çıktı: istek durum makinesi, yoğunluk hesabı, radar ve sohbet akışı, demo simülasyonu, anahtar yenileme.

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
