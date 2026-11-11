# Changelog

## 2026-11-11 · Instagram reel: siberpunk sürüm

- Yeni, ayrı bir reel: `reels-studio/cikti/saynovra-instagram-video-cyberpunk.mp4` (1080×1350, 30 fps, 46,5 sn, sessiz). Önceki astronotlu reel yerinde duruyor.
- Telefon çerçevesi yok. Kamera neon bir şehrin içinden ileri uçar; ufukta dev bir gezegen, çevresinde dönen usturlap halkaları ve gezegenin etrafında dönen yıldız izleri var. Her sahne değişiminde kamera bir kapıdan geçer (parlama ve kısa glitch ile).
- Altı özellik yolun üstünde hologram olarak çizilir: doluluk halkası ve saatlik tahmin, kendini yenileyen QR, set biten halter ile +2,5 kg ve dinlenme sayacı, takımyıldızı gibi çizilen hacim grafiği, buddy radarı ve eşleşme, çömelen iskelette diz açısı ile yarım tekrar ve hız kaybı uyarısı.
- Kod `web/src/lib/cyber/` altında; metinler ve süreler `config.ts` dosyasında. Okunan her şey marka fontları ve lime ile; mor ve macenta yalnızca atmosferde.
- Render betiği (`reels-studio/render.mjs`) yeniden düzenlendi: `node render.mjs cyber` yeni sürümü, parametresiz hâli eski reel'i üretir; `--stills=1,4.5` tek tek kare alır. Betik artık kendi klasöründen çalışır (sabit yol yok), Chrome profili geçici klasörde, tarayıcı susarsa 2 dakikada vazgeçer, kareler BT.709 olarak kodlanır.
- SAYNOVRA logosu ortak bir dosyaya alındı (`web/src/lib/saynovraLogo.ts`) ve kendini çizen bir giriş animasyonu kazandı.

## 2026-11-11 · Instagram reel: sinematik arka plan ve marka düzeni

- Reel arka planı yenilendi (`web/src/lib/reelBackground.ts`): üç katmanlı, paralaks kayan yıldız alanı, yavaş bulutsu ışığı, yörüngeden görülen ay ufku, yüklenen astronot çiziminden kesilmiş ve süzülen astronot (`web/public/reel/astronaut-cutout.png`), hafif kamera itişi, vinyet ve film greni. Eski çizim ay yüzeyi ve astronot kodu kaldırıldı.
- Logo marka SVG'sinden birebir çiziliyor (içi boş düğümler orta çubukta, lime noktalar uçlarda).
- Yazılar marka fontlarıyla çıkıyor: render betiği Space Grotesk, Inter ve JetBrains Mono'yu yükleyip doğrulamadan kare çizmiyor. Başlıklarda sıkı harf aralığı, etiketlerde aralıklı mono büyük harf.
- Renkler: turkuaz ve mavi vurgular lime'a çekildi; bilgi kartındaki trafik ışığı noktaları yerine lime kare ve mono etiket geldi. Metinler: "Yapay zekâ", slogan "Fikirden çalışan sisteme."

## 2026-11-10 · Sprint 6: eğitmen, telefonda AI Form, güvenlik

- AI Form beş hareket oldu: shoulder press (karşıdan, iki dirseğin ortalaması), biceps curl ve triceps pushdown eklendi. Yeni uyarılar: dirsek gövdeden uzaklaştı (gövde ile üst kol arası 30°'den fazla), curl'de gövde sallandı, altta ya da üstte kol tam açılmadı. Hareketler `shared/pose.ts` içinde veriyle tanımlanıyor; curl'de kaldırma süresi kapanma fazından ölçülüyor.
- Kare kare analiz tek fonksiyona taşındı (`analyzeFrame`); web sayfası ve telefon aynı kodu çalıştırıyor.
- Telefonda AI Form: kamera ve MediaPipe modeli uygulamanın içindeki web görünümünde (`react-native-webview` 14.0.1) telefonda çalışır, uygulamaya yalnızca iskelet noktaları gelir. Antrenman sekmesinde "AI Form" kartı, antrenmanda desteklenen harekette "Formunu AI ile kontrol et", ön/arka kamera geçişi. Emülatörde model yüklendi; kameranın web görünümünde açıldığı gerçek telefonda doğrulanmadı.
- Eğitmen hesabı: resepsiyonda "Yeni hesap" ilk adımda Üye / Eğitmen sorar; eğitmeni yalnızca salon sahibi açar, eğitmene ayrı aydınlatma metni gösterilir, paket satılmaz. Üye kartından eğitmen atanır. Eğitmen uygulamada yalnızca kendi üyelerini görür (başkasınınki 404): salondakiler canlı, haftalık hacim, son antrenmanlar, rekorlar, program atama. Kapıdan üyelik aranmadan geçer.
- Üye tarafı: Antrenman sekmesinde eğitmenin adı ve "Eğitmenin atadı" etiketi; atama canlı olayla (`training`) anında düşer. Üye programı değiştirirken eğitmenin atadığı programda önce onay sorulur.
- Giriş deneme sınırı: personel PIN'i (aynı cihazdan 5), üye ve eğitmen girişi (aynı telefona 5, aynı cihazdan 20) ve kodla etkinleştirme (aynı cihazdan 10) 15 dakikada dolunca 15 dakika 429 döner, `Retry-After` ile. Sayaçlar sunucu belleğinde.
- Profil düzenleme: üye boy, kilo, doğum yılı, cinsiyet ve hedefini uygulamadan günceller. Açık rızası yoksa düzenleme ekranında metni onaylayarak verir; rıza personelsiz kaydedilir.
- Dondurma hakkı dolduğu gün üyelik kendiliğinden aktif olur (günler bitişe eklenir, yenileme kayar); sunucu açılışta ve 10 dakikada bir tarar, kapı da okutulan üyeyi tarar. İşlem geçmişinde "Otomatik" yazar.
- Göç 6: `members.role`, `members.trainer_id` (tetikleyiciler eğitmeni doğrular, hesap türü değişmez), `member_programs.assigned_by`; `membership_events.created_by` yalnızca otomatik çözmede boş olabilir. Hareket bilgisine `slug` eklendi.
- Örnek veri: iki eğitmen (Hakan Koç, Derya Aksoy), demo üye Hakan'a atanmış ve programını Hakan atamış; her eğitmene yaklaşık 20 üye.
- Telefonda AI Form kamera izni artık Expo'nun kendi kamera modülüyle (`expo-camera`) isteniyor; Expo Go izni her proje için ayrı tuttuğu için genel Android isteği ekranı "Kamera izni bekleniyor"da bırakıyordu. İzin 15 saniyede yanıt vermezse ekran beklemek yerine "Tekrar dene / Ayarları aç" gösterir.
- Eğitmen girişinde "Unmatched route" hatası düzeltildi: kök adres hesap türüne göre yönlendirir (üye ana sayfaya, eğitmen Üyelerim'e); üye ana sayfasının dosyası `(tabs)/home.tsx` oldu.
- Testler 105'ten 125'e çıktı.

## 2026-11-10 · KVKK metni

- Rıza geri alma ürüne eklenmeyecek (kurucu kararı): açık rıza metninden "rızamı istediğim zaman resepsiyondan geri alabilirim" cümlesi ve uygulamanın KVKK ekranındaki geri alma notu kaldırıldı. Metin değiştiği için sürüm `2026-11-10` oldu; daha önce verilen rızalar `2026-11` sürümüyle kayıtlı kalır.
- Sprint 6 planı `PLAN.md` içinde: eğitmen hesabı, telefonda AI Form ve üç yeni hareket (shoulder press, biceps curl, triceps pushdown), giriş deneme sınırı, profil düzenleme, dondurmanın kendiliğinden bitmesi.

## 2026-11-10 · Sprint 5: yeni üye kaydı

- Resepsiyonda "Yeni üye": ad soyad ve telefon, KVKK, isteğe bağlı ilk paket, ardından ekranda 6 haneli etkinleştirme kodu. Telefon yazılırken numara kayıtlıysa uyarı ve "Üyeyi aç".
- KVKK: aydınlatma metni onayı zorunlu; boy, kilo, doğum yılı, cinsiyet ve hedef yalnızca ayrı açık rızayla kaydedilir, rıza yokken gönderilirse sunucu reddeder. Rızalar metin sürümü, zaman ve görevliyle `member_consents` tablosuna yazılır; tetikleyiciler güncellemeyi ve silmeyi engeller. Metinler `shared/consent.ts` içinde.
- Hesap, rızalar, ilk satış ve kod tek işlemde yazılır; biri başarısızsa hiçbiri yazılmaz.
- Üye şifresini kendisi belirler: uygulamada "İlk kez mi giriyorsun? Kodla etkinleştir" ekranı (telefon, kod, yeni şifre). Kod 15 dakika geçerli, tek kullanımlık, sunucuda yalnızca özeti tutulur ve loglanmaz; 5 yanlış denemede geçersizleşir. Bilinmeyen telefon, yanlış kod ve süresi dolmuş kod aynı cevabı alır.
- Şifre sıfırlama: resepsiyon üye kartından yeni kod verir. Yeni şifre belirlenince eski oturumlar kapanır (`members.session_epoch` oturum anahtarına yazılır; sunucuda oturum tutulmaz). Bu sürümden önceki anahtarlar 0 sayılır, açık oturumlar bozulmaz.
- Herkese açık `POST /auth/member/register` kaldırıldı (kimlik doğrulamasızdı, hiçbir ekran kullanmıyordu). Hesabı yalnızca personel açar: `POST /staff/members`; kod `POST /staff/members/:id/activation`; etkinleştirme `POST /auth/member/activate`; üyenin rızaları `GET /me/consents`.
- Üye kartında "Uygulama hesabı" bölümü (etkin mi, geçerli kod, rıza geçmişi), listede "Yeni" etiketi; kayıt ve etkinleştirme canlı olayla (`member`) resepsiyona düşer.
- Mobil profilde "KVKK ve onaylarım": aydınlatma metni ve verilen rızalar.
- Göç 5: `member_activations`, `member_consents`, `members.activated_at`, `members.session_epoch`, `members.modified_by`. Mevcut üyeler etkin sayılır.
- Örnek veri: tüm üyelerin rıza kaydı var; Selin Arıkan (`5550000999`) kaydedilmiş ama uygulamaya girmemiş olarak gelir. İkili görünüm prova akışına kayıt adımları eklendi.
- Testler 88'den 105'e çıktı: kayıt, kod, rıza, oturum düşürme, göç ve kayıttan kapıya uçtan uca akış.

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
