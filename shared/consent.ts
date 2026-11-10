// KVKK texts shown at reception and in the member app. Dependency-free like contract.ts.
// Changing any text means a new KVKK_NOTICE_VERSION: consents already given keep the version
// they were given for, so it is always clear which wording a member agreed to.
// Demo wording for a fictional gym; a real gym has its own text reviewed by counsel.

export const KVKK_NOTICE_VERSION = '2026-11';

export const KVKK_NOTICE_TITLE = 'Kişisel verilerin işlenmesi hakkında aydınlatma metni';

export const KVKK_NOTICE_PARAGRAPHS: readonly string[] = [
  'Veri sorumlusu: NOVRA GYM (bu bir demo salondur; gerçek kişi verisi işlenmez).',
  'İşlenen veriler: ad soyad, cep telefonu, üyelik ve ödeme kayıtları, kapı giriş ve çıkış kayıtları, uygulamada tuttuğun antrenman kayıtları ve buddy radarında paylaştığın ilan ve mesajlar.',
  'Amaç ve hukuki sebep: üyelik sözleşmesinin kurulması ve yürütülmesi (KVKK m. 5/2-c), salona güvenli giriş ve çıkış, yasal saklama yükümlülükleri (m. 5/2-ç). Ödeme kartı bilgisi alınmaz, kimlik numarası istenmez.',
  'Aktarım: veriler bu salonun kendi bilgisayarında tutulur, üçüncü kişilere aktarılmaz, yurt dışına gönderilmez. Kamerayla form analizi yapıldığında görüntü kaydedilmez ve gönderilmez.',
  'Saklama: üyelik bitiminden sonra yasal süreler boyunca saklanır, süre dolunca silinir veya anonimleştirilir.',
  'Hakların (KVKK m. 11): verilerinin işlenip işlenmediğini öğrenme, düzeltilmesini veya silinmesini isteme, işlemeye itiraz etme. Başvuru için resepsiyona yazılı olarak başvurabilirsin.',
];

export const OPTIONAL_DATA_TITLE = 'İsteğe bağlı bilgiler için açık rıza';

export const OPTIONAL_DATA_TEXT =
  'Doğum yılım, cinsiyetim, boyum, kilom ve antrenman hedefimin, bana uygun program ve ağırlık önerisi sunulması amacıyla işlenmesine açık rıza veriyorum. Boy ve kilo sağlıkla ilgili sayılabileceği için bu bilgiler yalnızca rızamla kaydedilir. Rıza vermezsem üyeliğim etkilenmez; rızamı istediğim zaman resepsiyondan geri alabilirim.';
