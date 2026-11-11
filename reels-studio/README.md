# SAYNOVRA · Instagram Video & Gönderi Stüdyosu (`reels-studio/`)

`@saynovra` Instagram hesabınız için hazırlanan kapsamlı video, Reels ve gönderi düzenleme merkezi.

## Hızlı Başlatma

- **Canlı Stüdyoyu Tarayıcıda Açmak İçin:** [`baslat.cmd`](baslat.cmd) dosyasına çift tıklayın (veya açık olan web sunucusunda `http://localhost:5173/#/reel` adresine gidin).
- **Doğrudan MP4 Video Üretmek İçin:** [`video-uret.cmd`](video-uret.cmd) dosyasına çift tıklayın.

- **Siberpunk Sürümü Üretmek İçin:** [`video-uret-cyberpunk.cmd`](video-uret-cyberpunk.cmd) dosyasına çift tıklayın.

## Çıktı Dosyaları (`reels-studio/cikti/`)

- 🎬 **Hazır 60 Sn Instagram Gönderi Videosu (`1080×1350` - 4:5):** `cikti/saynovra-instagram-video.mp4`
- 🖼️ **Hazır Kapak Görseli (`1080×1350`):** `cikti/saynovra-instagram-kapak.png`
- **Siberpunk sürüm (46,5 sn, 30 fps, sessiz):** `cikti/saynovra-instagram-video-cyberpunk.mp4`, kapağı `cikti/saynovra-instagram-kapak-cyberpunk.png`

## Siberpunk Sürüm

Telefon çerçevesi yok. Kamera neon bir şehrin içinden ileri uçar; ufukta dev bir gezegen ve çevresinde dönen usturlap halkaları vardır. Her sahne değişiminde kamera bir "astral kapıdan" geçer. NOVRA GYM'in altı özelliği yolun üstünde hologram olarak görünür: canlı doluluk, QR geçiş, antrenman, gelişim grafiği, buddy radarı, AI form analizi.

- **Kod:** `web/src/lib/cyber/` (gök, şehir, kapılar, hologramlar ve yazılar ayrı dosyalarda).
- **Metinleri ve süreleri değiştirmek:** `web/src/lib/cyber/config.ts`. Her sahnenin başlığı, cümlesi ve süresi oradadır.
- **Tam videoyu üretmeden kare görmek:** `node render.mjs cyber --stills=3.4,10.5,44.5` komutu o saniyelerin PNG karelerini `cikti/kareler/` klasörüne yazar.
- **Renkler:** okunan her şey marka setindedir (lime, beyaz, Space Grotesk, Inter, JetBrains Mono). Mor ve macenta yalnızca atmosferde ve şehir ışıklarındadır.
- Hologramlardaki sayılar ve isimler örnektir, gerçek kişi ya da veri değildir.

## Özellikler

1. **Sinematik uzay arka planı:** paralaks yıldızlar, bulutsu ışığı, ay ufku, süzülen astronot (telefonun karşı tarafında, telefona uzanır), vinyet ve film greni. Kod: `web/src/lib/reelBackground.ts`. Marka fontları ve logo SAYNOVRA el kitabına göre.
2. **Instagram Gönderi Boyutu (`1080×1350` · 4:5) + Reels (`1080×1920` · 9:16) + Kare (`1080×1080` · 1:1):**
   - Tek tıkla boyut değiştirme.
   - Üstteki hikaye çubukları kaldırıldı; tüm başlıklar ve **bilgi kartı** yazıları büyütülüp ortalandı.
3. **Kendi Ekran Görüntünü Yükle veya 10 Hazır Şablondan Seç:**
   - Her sahnede **"Telefona Özel Görsel Yükle"** butonuyla başka projelerinizin ekran görüntülerini telefon çerçevesine yerleştirebilirsiniz.
   - `+ Yeni Sahne Ekle` ile istediğiniz kadar sahne ekleyip silebilirsiniz.

