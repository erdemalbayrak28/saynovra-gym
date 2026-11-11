/** What the cyberpunk reel says and for how long: one scene per NOVRA GYM feature, then the outro. */

export type HologramKind = 'occupancy' | 'qr' | 'workout' | 'progress' | 'radar' | 'form';

export interface CyberScene {
  id: string;
  hologram: HologramKind;
  durationSec: number;
  badge: string;
  headlineTop: string;
  headlineAccent: string;
  body: string;
}

export interface CyberReelConfig {
  brandName: string;
  productTitle: string;
  productLine: string;
  brandLine: string;
  brandTagline: string;
  brandWebsite: string;
  footerLine: string;
  outroDurationSec: number;
  scenes: readonly CyberScene[];
}

const SCENE_SEC = 7;

export const DEFAULT_CYBER_CONFIG: CyberReelConfig = {
  brandName: 'SAYNOVRA',
  productTitle: 'NOVRA GYM',
  productLine: 'NOVRA GYM · Spor Salonu Sistemi',
  brandLine: 'SOFTWARE • AI • AUTOMATION',
  brandTagline: 'Fikirden çalışan sisteme.',
  brandWebsite: 'saynovra.com',
  footerLine: 'YAZILIM • YAPAY ZEKÂ • OTOMASYON',
  outroDurationSec: 4.5,
  scenes: [
    {
      id: 'occupancy',
      hologram: 'occupancy',
      durationSec: SCENE_SEC,
      badge: 'ÜYE EKOSİSTEMİ',
      headlineTop: 'Spor salonunda',
      headlineAccent: 'deftere veda.',
      body: 'Üye salona çıkmadan içerideki kişi sayısını ve saatlik yoğunluğu görür.',
    },
    {
      id: 'qr',
      hologram: 'qr',
      durationSec: SCENE_SEC,
      badge: 'TURNİKE & GÜVENLİK',
      headlineTop: 'Kopyalanamaz',
      headlineAccent: 'QR ile geçiş.',
      body: 'İmzalı kod 30 saniyede bir yenilenir. Ekran görüntüsü geçersizdir.',
    },
    {
      id: 'workout',
      hologram: 'workout',
      durationSec: SCENE_SEC,
      badge: 'AKILLI KOÇLUK',
      headlineTop: 'Programın ve koçun',
      headlineAccent: 'cebinde.',
      body: 'Hedefi tamamladıysan sistem ağırlığı 2,5 kg artırır, dinlenme sayacını başlatır.',
    },
    {
      id: 'progress',
      hologram: 'progress',
      durationSec: SCENE_SEC,
      badge: 'VERİ & EĞİTMEN',
      headlineTop: 'Hacimden rekora',
      headlineAccent: 'tüm gelişimin.',
      body: 'Haftalık tonajın ve rekorların grafiğe dökülür. Eğitmenin anlık görür.',
    },
    {
      id: 'radar',
      hologram: 'radar',
      durationSec: SCENE_SEC,
      badge: 'SOSYAL ANTRENMAN',
      headlineTop: 'Salonda yalnız',
      headlineAccent: 'çalışma.',
      body: 'Yalnızca o an içeride olan üyeler görünür. Tek dokunuşla eşleş, mesajlaş.',
    },
    {
      id: 'form',
      hologram: 'form',
      durationSec: SCENE_SEC,
      badge: 'YAPAY ZEKÂ',
      headlineTop: 'Kamerayla canlı',
      headlineAccent: 'form analizi.',
      body: 'Diz ve dirsek açısını anlık ölçer, yarım tekrarı ve hız kaybını yakalar.',
    },
  ],
};

export function getCyberDuration(config: CyberReelConfig = DEFAULT_CYBER_CONFIG): number {
  return config.scenes.reduce((sum, scene) => sum + scene.durationSec, 0) + config.outroDurationSec;
}

/** Where a moment falls: which scene (or the outro), and how far it is from the cuts around it. */
export interface Timeline {
  /** Index of the active scene; equals `scenes.length` during the outro. */
  index: number;
  /** The active scene, or null during the outro. */
  scene: CyberScene | null;
  /** Seconds since the scene (or the outro) began. */
  elapsed: number;
  /** Length of the scene (or the outro). */
  duration: number;
  /** Seconds until the next cut; Infinity during the outro. */
  untilCut: number;
}

export function timelineAt(config: CyberReelConfig, timeSec: number): Timeline {
  const t = Math.max(0, Math.min(getCyberDuration(config), timeSec));
  let start = 0;
  for (const [index, scene] of config.scenes.entries()) {
    const end = start + scene.durationSec;
    if (t < end) {
      return { index, scene, elapsed: t - start, duration: scene.durationSec, untilCut: end - t };
    }
    start = end;
  }
  return {
    index: config.scenes.length,
    scene: null,
    elapsed: t - start,
    duration: config.outroDurationSec,
    untilCut: Infinity,
  };
}
