import { drawFilmFinish, drawSpaceBackground } from './reelBackground';
import { drawSaynovraLogo } from './saynovraLogo';

export type AtmosphereTheme = 'moon-walk' | 'moon-flag' | 'moon-lift' | 'moon-laptop' | 'moon-radar' | 'moon-reach';
export type PhonePosition = 'right' | 'left';
export type ScreenKind =
  | 'home'
  | 'qr'
  | 'workout'
  | 'progress'
  | 'buddy'
  | 'aiform'
  | 'crm-calendar'
  | 'dashboard'
  | 'rtl-web'
  | 'mobile-menu';
export type AspectRatioPreset = '4:5' | '9:16' | '1:1';
export type DeviceFrameKind = 'iphone' | 'macbook' | 'monitor' | 'typography';

export interface ReelScene {
  id: string;
  screen: ScreenKind;
  deviceKind?: DeviceFrameKind;
  durationSec: number;
  theme: AtmosphereTheme;
  accentColor?: string;
  phonePosition: PhonePosition;
  badgeText: string;
  headlineTop: string;
  headlineAccent: string;
  cardTitle: string;
  cardBody: string;
  cardSubtag: string;
  customImageUrl?: string;
}

export interface ReelConfig {
  aspectRatio: AspectRatioPreset;
  brandName: string;
  brandTagline: string;
  brandWebsite: string;
  productTitle: string;
  pills: [string, string, string];
  outroDurationSec: number;
  scenes: ReelScene[];
}

export const ASPECT_SIZES: Record<AspectRatioPreset, { width: number; height: number; label: string }> = {
  '4:5': { width: 1080, height: 1350, label: 'Instagram Gönderi (4:5 · 1080×1350)' },
  '9:16': { width: 1080, height: 1920, label: 'Instagram Reels / Story (9:16 · 1080×1920)' },
  '1:1': { width: 1080, height: 1080, label: 'Instagram Kare (1:1 · 1080×1080)' },
};

export const DEFAULT_REEL_CONFIG: ReelConfig = {
  aspectRatio: '4:5',
  brandName: 'SAYNOVRA',
  brandTagline: 'Fikirden çalışan sisteme.',
  brandWebsite: 'saynovra.com',
  productTitle: 'NOVRA GYM',
  pills: ['Yazılım', 'Yapay zekâ', 'Otomasyon'],
  outroDurationSec: 4,
  scenes: [
    {
      id: 'home',
      screen: 'home',
      deviceKind: 'iphone',
      durationSec: 9,
      theme: 'moon-walk',
      accentColor: '#C8F031',
      phonePosition: 'right',
      badgeText: 'ÜYE EKOSİSTEMİ',
      headlineTop: 'Spor salonunda',
      headlineAccent: 'deftere veda.',
      cardTitle: 'Canlı doluluk & tahmin',
      cardBody: 'Üye salona çıkmadan içerideki kişi sayısını ve saatlik yoğunluğu anında görür.',
      cardSubtag: 'CANLI VERİ',
    },
    {
      id: 'qr',
      screen: 'qr',
      deviceKind: 'iphone',
      durationSec: 10,
      theme: 'moon-flag',
      accentColor: '#C8F031',
      phonePosition: 'left',
      badgeText: 'TURNİKE & GÜVENLİK',
      headlineTop: 'Kopyalanamaz',
      headlineAccent: 'QR ile geçiş.',
      cardTitle: 'Kriptografik imza',
      cardBody: 'HMAC-SHA256 imzalı kod 30 saniyede bir yenilenir. Ekran görüntüsü geçersizdir.',
      cardSubtag: 'OFFLINE ÇALIŞIR',
    },
    {
      id: 'workout',
      screen: 'workout',
      deviceKind: 'iphone',
      durationSec: 10,
      theme: 'moon-lift',
      accentColor: '#C8F031',
      phonePosition: 'right',
      badgeText: 'AKILLI KOÇLUK',
      headlineTop: 'Programın ve koçun',
      headlineAccent: 'cebinde.',
      cardTitle: 'Otomatik ağırlık artışı',
      cardBody: 'Hedefi tamamladıysan sistem ağırlığı +2,5 kg artırır, dinlenme sayacını başlatır.',
      cardSubtag: 'AKILLI PROGRESYON',
    },
    {
      id: 'progress',
      screen: 'progress',
      deviceKind: 'iphone',
      durationSec: 9,
      theme: 'moon-laptop',
      accentColor: '#C8F031',
      phonePosition: 'left',
      badgeText: 'VERİ & EĞİTMEN',
      headlineTop: 'Hacimden rekora',
      headlineAccent: 'tüm gelişimin.',
      cardTitle: 'Eğitmen senkronu',
      cardBody: 'Haftalık kaldırdığın toplam tonaj ve rekorların grafiklenir; eğitmenin anlık görür.',
      cardSubtag: 'CANLI TAKİP',
    },
    {
      id: 'buddy',
      screen: 'buddy',
      deviceKind: 'iphone',
      durationSec: 9,
      theme: 'moon-radar',
      accentColor: '#C8F031',
      phonePosition: 'right',
      badgeText: 'SOSYAL ANTRENMAN',
      headlineTop: 'Salonda yalnız',
      headlineAccent: 'çalışma.',
      cardTitle: 'Canlı Spotter Radarı',
      cardBody: 'Yalnızca o an içeride olan üyeler görünür. Tek dokunuşla eşleş ve mesajlaş.',
      cardSubtag: 'SALON RADARI',
    },
    {
      id: 'aiform',
      screen: 'aiform',
      deviceKind: 'iphone',
      durationSec: 9,
      theme: 'moon-reach',
      accentColor: '#C8F031',
      phonePosition: 'left',
      badgeText: 'YAPAY ZEKÂ',
      headlineTop: 'Kamerayla canlı',
      headlineAccent: 'form analizi.',
      cardTitle: 'MediaPipe iskelet takibi',
      cardBody: 'Diz ve dirsek açısını gerçek zamanlı ölçer, yarım tekrarları ve hız kaybını yakalar.',
      cardSubtag: 'AI FORM KOÇU',
    },
  ],
};

export function getTotalDuration(config: ReelConfig): number {
  return config.scenes.reduce((acc, s) => acc + s.durationSec, 0) + config.outroDurationSec;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function easeOutCubic(x: number): number {
  const t = clamp(x, 0, 1);
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutCubic(x: number): number {
  const t = clamp(x, 0, 1);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Draws the signature @saynovra floating glass callout card with Red/Yellow/Green dots
 * and LARGER, CENTERED typography as requested!
 */
function drawCalloutCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  title: string,
  body: string,
  subtag: string,
  progress: number,
  targetX: number,
  targetY: number,
  accentColor = '#C8F031',
): void {
  const enter = easeOutCubic(clamp(progress * 3.2, 0, 1));
  const slideY = (1 - enter) * 32;
  const cy = y + slideY;

  ctx.save();
  ctx.globalAlpha = enter;

  // Larger centered fonts inside the callout card
  const titleFont = '700 35px "Space Grotesk", system-ui, sans-serif';
  ctx.font = titleFont;
  const titleLines = wrapText(ctx, title, w - 64);

  const bodyFont = '400 24px Inter, system-ui, sans-serif';
  ctx.font = bodyFont;
  const bodyLines = wrapText(ctx, body, w - 64);

  const cardH = 92 + titleLines.length * 42 + bodyLines.length * 34 + 54;

  // Connector line from card to phone highlight point
  ctx.save();
  const cardAnchorX = targetX > x + w / 2 ? x + w : x;
  const cardAnchorY = cy + cardH * 0.45;
  const connGrad = ctx.createLinearGradient(cardAnchorX, cardAnchorY, targetX, targetY);
  connGrad.addColorStop(0, accentColor);
  connGrad.addColorStop(1, 'rgba(200, 240, 49, 0.18)');
  ctx.strokeStyle = connGrad;
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(cardAnchorX, cardAnchorY);
  ctx.lineTo(targetX, targetY);
  ctx.stroke();

  // Glowing pulse dot on the phone target
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(targetX, targetY, 9, 0, Math.PI * 2);
  ctx.fillStyle = accentColor;
  ctx.shadowColor = accentColor;
  ctx.shadowBlur = 18;
  ctx.fill();
  ctx.restore();

  // Card drop shadow & dark glass fill
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.78)';
  ctx.shadowBlur = 42;
  ctx.shadowOffsetY = 18;
  roundRect(ctx, x, cy, w, cardH, 30);
  const cardGrad = ctx.createLinearGradient(x, cy, x + w, cy + cardH);
  cardGrad.addColorStop(0, 'rgba(18, 23, 35, 0.94)');
  cardGrad.addColorStop(1, 'rgba(10, 13, 21, 0.96)');
  ctx.fillStyle = cardGrad;
  ctx.fill();
  ctx.restore();

  // Glowing border
  roundRect(ctx, x, cy, w, cardH, 30);
  ctx.strokeStyle = 'rgba(200, 240, 49, 0.28)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Brand label row: a lime square and the mono, letter-spaced tag (no window-chrome dots).
  const padX = x + 32;
  const labelY = cy + 40;
  ctx.fillStyle = accentColor;
  ctx.fillRect(padX, labelY - 11, 11, 11);
  ctx.font = '500 15px "JetBrains Mono", monospace';
  ctx.letterSpacing = '2.1px';
  ctx.textAlign = 'left';
  ctx.fillText(subtag.toLocaleUpperCase('tr-TR'), padX + 22, labelY);
  ctx.letterSpacing = '0px';

  // Title, left-aligned like the brand cards
  let cursorY = cy + 92;
  ctx.font = titleFont;
  ctx.letterSpacing = '-0.5px';
  ctx.fillStyle = '#EEF1F6';
  for (const line of titleLines) {
    ctx.fillText(line, padX, cursorY);
    cursorY += 42;
  }
  ctx.letterSpacing = '0px';

  // Body in the brand's soft grey
  cursorY += 8;
  ctx.font = bodyFont;
  ctx.fillStyle = '#A3AABD';
  for (const line of bodyLines) {
    ctx.fillText(line, padX, cursorY);
    cursorY += 34;
  }

  // Short lime rule closing the card
  const barY = cy + cardH - 26;
  ctx.fillStyle = accentColor;
  ctx.fillRect(padX, barY, 56, 4);

  ctx.textAlign = 'left';
  ctx.restore();
}

function drawPhoneMockup(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  pw: number,
  ph: number,
  screen: ScreenKind,
  sceneProgress: number,
  globalTime: number,
  customImage?: HTMLImageElement | null,
): { highlightX: number; highlightY: number } {
  ctx.save();

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.82)';
  ctx.shadowBlur = 55;
  ctx.shadowOffsetY = 24;
  roundRect(ctx, px, py, pw, ph, 58);
  ctx.fillStyle = '#1E2433';
  ctx.fill();
  ctx.restore();

  roundRect(ctx, px, py, pw, ph, 58);
  const rimGrad = ctx.createLinearGradient(px, py, px + pw, py + ph);
  rimGrad.addColorStop(0, '#5A6578');
  rimGrad.addColorStop(0.5, '#1A202C');
  rimGrad.addColorStop(1, '#2D3748');
  ctx.strokeStyle = rimGrad;
  ctx.lineWidth = 4;
  ctx.stroke();

  const bezel = 11;
  const sx = px + bezel;
  const sy = py + bezel;
  const sw = pw - bezel * 2;
  const sh = ph - bezel * 2;

  roundRect(ctx, sx, sy, sw, sh, 48);
  ctx.fillStyle = '#0A0D14';
  ctx.fill();

  ctx.save();
  roundRect(ctx, sx, sy, sw, sh, 48);
  ctx.clip();

  ctx.fillStyle = '#0A0D14';
  ctx.fillRect(sx, sy, sw, sh);

  if (customImage && customImage.complete && customImage.naturalWidth > 0) {
    ctx.drawImage(customImage, sx, sy, sw, sh);
    ctx.restore();
    ctx.restore();
    return { highlightX: px + pw / 2, highlightY: py + ph * 0.45 };
  }

  // Scale internal phone UI proportionally so it fits any phone height cleanly
  const refW = 476;
  const refH = 996;
  const scaleX = sw / refW;
  const scaleY = sh / refH;

  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(scaleX, scaleY);

  // Status bar + Dynamic Island
  ctx.font = '600 16px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#EEF1F6';
  ctx.fillText('19:07', 34, 34);

  const islandW = 116;
  const islandH = 30;
  roundRect(ctx, (refW - islandW) / 2, 14, islandW, islandH, 15);
  ctx.fillStyle = '#000000';
  ctx.fill();

  roundRect(ctx, refW - 58, 21, 26, 13, 4);
  ctx.strokeStyle = '#EEF1F6';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  roundRect(ctx, refW - 55, 24, 18, 7, 2);
  ctx.fillStyle = '#C8F031';
  ctx.fill();

  const cx = 22;
  const cy = 64;
  const cw = refW - 44;

  let localHighlightY = refH * 0.42;

  if (screen === 'home') {
    localHighlightY = drawHomeScreen(ctx, cx, cy, cw, sceneProgress);
  } else if (screen === 'qr') {
    localHighlightY = drawQrScreen(ctx, cx, cy, cw, sceneProgress, globalTime);
  } else if (screen === 'workout') {
    localHighlightY = drawWorkoutScreen(ctx, cx, cy, cw, sceneProgress);
  } else if (screen === 'progress') {
    localHighlightY = drawProgressScreen(ctx, cx, cy, cw, sceneProgress);
  } else if (screen === 'buddy') {
    localHighlightY = drawBuddyScreen(ctx, cx, cy, cw, sceneProgress);
  } else if (screen === 'aiform') {
    localHighlightY = drawAiFormScreen(ctx, cx, cy, cw, sceneProgress, globalTime);
  } else if (screen === 'crm-calendar') {
    localHighlightY = drawCrmCalendarScreen(ctx, cx, cy, cw, sceneProgress);
  } else if (screen === 'mobile-menu') {
    localHighlightY = drawMobileMenuScreen(ctx, cx, cy, cw, sceneProgress);
  } else if (screen === 'rtl-web') {
    localHighlightY = drawRtlWebScreen(ctx, cx, cy, cw, sceneProgress);
  } else {
    localHighlightY = drawHomeScreen(ctx, cx, cy, cw, sceneProgress);
  }

  // Bottom Tab Bar
  const tabH = 74;
  const tabY = refH - tabH;
  ctx.fillStyle = 'rgba(18, 22, 31, 0.96)';
  ctx.fillRect(0, tabY, refW, tabH);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, tabY);
  ctx.lineTo(refW, tabY);
  ctx.stroke();

  const tabs: { label: string; match: ScreenKind[] }[] = [
    { label: 'Salon', match: ['home', 'crm-calendar', 'mobile-menu', 'rtl-web'] },
    { label: 'QR Geçiş', match: ['qr'] },
    { label: 'Antrenman', match: ['workout', 'progress', 'aiform'] },
    { label: 'Buddy', match: ['buddy'] },
    { label: 'Profil', match: [] },
  ];
  const tabW = refW / tabs.length;
  tabs.forEach((tab, idx) => {
    const active = tab.match.includes(screen);
    const tx = idx * tabW + tabW / 2;
    ctx.beginPath();
    ctx.arc(tx, tabY + 22, 6, 0, Math.PI * 2);
    ctx.fillStyle = active ? '#C8F031' : '#7C849B';
    ctx.fill();

    ctx.font = `${active ? '700' : '500'} 12px Inter, system-ui, sans-serif`;
    ctx.fillStyle = active ? '#C8F031' : '#7C849B';
    ctx.textAlign = 'center';
    ctx.fillText(tab.label, tx, tabY + 46);
  });
  ctx.textAlign = 'left';

  roundRect(ctx, (refW - 120) / 2, refH - 12, 120, 5, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fill();

  ctx.restore();
  ctx.restore();
  ctx.restore();

  return {
    highlightX: px + pw / 2,
    highlightY: sy + localHighlightY * scaleY,
  };
}

function drawPhoneCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  borderColor = 'rgba(255,255,255,0.08)',
  bgColor = '#12161F',
): void {
  roundRect(ctx, x, y, w, h, 22);
  ctx.fillStyle = bgColor;
  ctx.fill();
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  fg: string,
  bg: string,
): number {
  ctx.font = '600 12px "JetBrains Mono", monospace';
  const tw = ctx.measureText(text).width;
  const pw = tw + 22;
  roundRect(ctx, x, y, pw, 26, 13);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.fillText(text, x + 11, y + 17);
  return pw;
}

function drawHomeScreen(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  progress: number,
): number {
  ctx.font = '500 12px "JetBrains Mono", monospace';
  ctx.fillStyle = '#7C849B';
  ctx.fillText('NOVRA GYM · KADIKÖY', x, y + 14);

  ctx.font = '700 28px "Space Grotesk", system-ui, sans-serif';
  ctx.fillStyle = '#EEF1F6';
  ctx.fillText('Merhaba, Erdem', x, y + 48);

  drawPill(ctx, x + w - 110, y + 24, 'İÇERİDESİN', '#C8F031', 'rgba(200,240,49,0.16)');

  const occY = y + 68;
  drawPhoneCard(ctx, x, occY, w, 152, 'rgba(200,240,49,0.28)');
  ctx.font = '500 11px "JetBrains Mono", monospace';
  ctx.fillStyle = '#7C849B';
  ctx.fillText('CANLI SALON DOLULUĞU', x + 18, occY + 28);

  const animCount = Math.round(18 + 6 * easeOutCubic(clamp(progress * 2, 0, 1)));
  ctx.font = '700 42px "Space Grotesk", system-ui, sans-serif';
  ctx.fillStyle = '#C8F031';
  ctx.fillText(`${animCount}`, x + 18, occY + 78);

  ctx.font = '500 18px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#7C849B';
  ctx.fillText('/ 85 kişi', x + 76, occY + 76);

  drawPill(ctx, x + w - 132, occY + 48, 'RAHAT · %28', '#C8F031', 'rgba(200,240,49,0.15)');

  roundRect(ctx, x + 18, occY + 98, w - 36, 10, 5);
  ctx.fillStyle = '#1A1F2B';
  ctx.fill();
  roundRect(ctx, x + 18, occY + 98, (w - 36) * (animCount / 85), 10, 5);
  ctx.fillStyle = '#C8F031';
  ctx.fill();

  ctx.font = '400 13px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#7C849B';
  ctx.fillText('Son geçiş: 14 sn önce · Canlı WebSocket aktif', x + 18, occY + 134);

  const chartY = occY + 168;
  drawPhoneCard(ctx, x, chartY, w, 178);
  ctx.font = '500 11px "JetBrains Mono", monospace';
  ctx.fillStyle = '#7C849B';
  ctx.fillText('SAATLİK YOĞUNLUK (GEÇMİŞ 4 HAFTA)', x + 18, chartY + 28);

  const bars = [18, 26, 32, 24, 28, 42, 64, 78, 52, 34, 22, 14];
  const barAreaW = w - 36;
  const barGap = 8;
  const bw = (barAreaW - barGap * (bars.length - 1)) / bars.length;
  const maxBarH = 88;
  bars.forEach((val, idx) => {
    const bh = (val / 85) * maxBarH * easeOutCubic(clamp(progress * 2.5 - idx * 0.05, 0, 1));
    const bx = x + 18 + idx * (bw + barGap);
    const by = chartY + 136 - bh;
    roundRect(ctx, bx, by, bw, Math.max(6, bh), 4);
    ctx.fillStyle = idx === 4 ? '#C8F031' : 'rgba(255,255,255,0.16)';
    ctx.fill();
  });
  ctx.font = '500 11px "JetBrains Mono", monospace';
  ctx.fillStyle = '#7C849B';
  ctx.fillText('08:00', x + 18, chartY + 160);
  ctx.fillStyle = '#C8F031';
  ctx.fillText('ŞİMDİ', x + 18 + 4 * (bw + barGap) - 4, chartY + 160);
  ctx.fillStyle = '#7C849B';
  ctx.fillText('22:00', x + w - 58, chartY + 160);

  const memY = chartY + 194;
  drawPhoneCard(ctx, x, memY, w, 136);
  ctx.font = '500 11px "JetBrains Mono", monospace';
  ctx.fillStyle = '#7C849B';
  ctx.fillText('ÜYELİK PAKETİN', x + 18, memY + 28);
  drawPill(ctx, x + w - 92, memY + 12, 'AKTİF', '#C8F031', 'rgba(200,240,49,0.15)');

  ctx.font = '700 21px "Space Grotesk", system-ui, sans-serif';
  ctx.fillStyle = '#EEF1F6';
  ctx.fillText('Yıllık Pro Üyelik', x + 18, memY + 62);

  ctx.font = '400 14px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#7C849B';
  ctx.fillText('248 gün kaldı · 14 gün dondurma hakkı', x + 18, memY + 90);

  ctx.font = '600 13px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#EEF1F6';
  ctx.fillText('Eğitmen: Hakan Koç · Bugün Üst Vücut A', x + 18, memY + 116);

  return occY + 76;
}

function drawQrScreen(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  progress: number,
  globalTime: number,
): number {
  const scanned = progress > 0.46;

  ctx.font = '500 12px "JetBrains Mono", monospace';
  ctx.fillStyle = '#7C849B';
  ctx.fillText('KAPI GEÇİŞİ', x, y + 14);

  ctx.font = '700 26px "Space Grotesk", system-ui, sans-serif';
  ctx.fillStyle = '#EEF1F6';
  ctx.fillText(scanned ? 'Çıkış QR kodu' : 'Giriş QR kodu', x, y + 46);

  drawPill(ctx, x + w - 90, y + 22, 'CANLI', '#C8F031', 'rgba(200,240,49,0.16)');

  let curY = y + 66;

  if (scanned) {
    const bannerAnim = easeOutCubic(clamp((progress - 0.46) * 4, 0, 1));
    ctx.save();
    ctx.globalAlpha = bannerAnim;
    drawPhoneCard(ctx, x, curY, w, 82, '#C8F031', 'rgba(200,240,49,0.14)');
    ctx.beginPath();
    ctx.arc(x + 32, curY + 41, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#C8F031';
    ctx.fill();

    ctx.font = '700 17px "Space Grotesk", system-ui, sans-serif';
    ctx.fillStyle = '#EEF1F6';
    ctx.fillText('Kapı açıldı · Hoş geldin!', x + 58, curY + 36);

    ctx.font = '400 13px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#C8F031';
    ctx.fillText('Turnike 01 onayladı · Sıra #15 güncellendi', x + 58, curY + 60);
    ctx.restore();
    curY += 96;
  }

  const qrCardH = scanned ? 390 : 440;
  drawPhoneCard(ctx, x, curY, w, qrCardH);

  ctx.font = '700 18px "Space Grotesk", system-ui, sans-serif';
  ctx.fillStyle = '#EEF1F6';
  ctx.fillText('Erdem Albayrak', x + 20, curY + 34);

  ctx.font = '500 14px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#7C849B';
  ctx.fillText('Yön: ', x + 20, curY + 56);
  ctx.fillStyle = '#C8F031';
  ctx.fillText(scanned ? 'Çıkış' : 'Giriş', x + 56, curY + 56);

  ctx.font = '500 11px "JetBrains Mono", monospace';
  ctx.fillStyle = '#EEF1F6';
  ctx.fillText('HMAC-SHA256', x + w - 106, curY + 34);

  const qrBoxSize = scanned ? 216 : 244;
  const qrX = x + (w - qrBoxSize) / 2;
  const qrY = curY + 74;
  roundRect(ctx, qrX, qrY, qrBoxSize, qrBoxSize, 20);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();

  const cells = 19;
  const margin = 16;
  const cellSize = (qrBoxSize - margin * 2) / cells;
  ctx.fillStyle = '#0A0D14';
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      const inFinderTL = r < 7 && c < 7;
      const inFinderTR = r < 7 && c >= cells - 7;
      const inFinderBL = r >= cells - 7 && c < 7;
      if (inFinderTL || inFinderTR || inFinderBL) {
        const lr = r < 7 ? r : r - (cells - 7);
        const lc = c < 7 ? c : c - (cells - 7);
        const border = lr === 0 || lr === 6 || lc === 0 || lc === 6;
        const inner = lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4;
        if (border || inner) {
          ctx.fillRect(qrX + margin + c * cellSize, qrY + margin + r * cellSize, cellSize + 0.4, cellSize + 0.4);
        }
      } else {
        const seed = (r * 31 + c * 17 + (scanned ? 9 : 3)) % 11;
        if (seed < 5) {
          ctx.fillRect(qrX + margin + c * cellSize, qrY + margin + r * cellSize, cellSize + 0.3, cellSize + 0.3);
        }
      }
    }
  }

  const scanLineY = qrY + 14 + ((Math.sin(globalTime * 3.5) + 1) / 2) * (qrBoxSize - 28);
  ctx.save();
  ctx.strokeStyle = scanned ? '#C8F031' : '#C8F031';
  ctx.lineWidth = 3;
  ctx.shadowColor = scanned ? '#C8F031' : '#C8F031';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(qrX + 10, scanLineY);
  ctx.lineTo(qrX + qrBoxSize - 10, scanLineY);
  ctx.stroke();
  ctx.restore();

  const barBaseY = qrY + qrBoxSize + 24;
  const secsLeft = Math.max(4, Math.ceil(28 - progress * 14));
  ctx.font = '400 13px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#7C849B';
  ctx.fillText('Kendiliğinden yenilenir', x + 20, barBaseY);

  ctx.font = '600 13px "JetBrains Mono", monospace';
  ctx.fillStyle = '#C8F031';
  ctx.fillText(`${secsLeft} sn`, x + w - 58, barBaseY);

  roundRect(ctx, x + 20, barBaseY + 12, w - 40, 6, 3);
  ctx.fillStyle = '#1A1F2B';
  ctx.fill();
  roundRect(ctx, x + 20, barBaseY + 12, (w - 40) * (secsLeft / 30), 6, 3);
  ctx.fillStyle = '#C8F031';
  ctx.fill();

  ctx.font = '500 11px "JetBrains Mono", monospace';
  ctx.fillStyle = '#7C849B';
  ctx.fillText(
    scanned ? 'NG2.1.58194201.o.15.e41c92a0b31f8821' : 'NG2.1.58194201.i.14.8a3f19d47c2e904a',
    x + 20,
    barBaseY + 38,
  );

  return qrY + qrBoxSize / 2;
}

function drawWorkoutScreen(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  progress: number,
): number {
  const resting = progress > 0.52;

  ctx.font = '500 12px "JetBrains Mono", monospace';
  ctx.fillStyle = '#C8F031';
  ctx.fillText('GÜN 1/4 · ÜST VÜCUT HİPERTROFİ', x, y + 14);

  ctx.font = '700 26px "Space Grotesk", system-ui, sans-serif';
  ctx.fillStyle = '#EEF1F6';
  ctx.fillText('Barbell Bench Press', x, y + 46);

  const sugY = y + 64;
  drawPhoneCard(ctx, x, sugY, w, 78, 'rgba(200,240,49,0.35)', 'rgba(200,240,49,0.10)');
  ctx.font = '600 12px "JetBrains Mono", monospace';
  ctx.fillStyle = '#C8F031';
  ctx.fillText('+2,5 KG ARTIŞ ÖNERİSİ', x + 16, sugY + 26);

  ctx.font = '400 13px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#EEF1F6';
  ctx.fillText('Son 2 antrenmanda 80 kg ile 4×10 hedefi', x + 16, sugY + 48);
  ctx.fillText('RPE 7.5 ile tamamlandı. Bugün hedef: 82,5 kg.', x + 16, sugY + 66);

  const setY = sugY + 94;
  drawPhoneCard(ctx, x, setY, w, 240);
  ctx.font = '500 12px "JetBrains Mono", monospace';
  ctx.fillStyle = '#7C849B';
  ctx.fillText(resting ? 'SET 2 / 4 TAMAMLANDI' : 'AKTİF SET 2 / 4 · HEDEF 8-10 TEKRAR', x + 18, setY + 28);

  const boxW = (w - 48) / 2;
  const boxY = setY + 44;
  roundRect(ctx, x + 18, boxY, boxW, 96, 16);
  ctx.fillStyle = '#1A1F2B';
  ctx.fill();
  ctx.font = '500 11px "JetBrains Mono", monospace';
  ctx.fillStyle = '#7C849B';
  ctx.fillText('AĞIRLIK (KG)', x + 32, boxY + 26);
  ctx.font = '700 34px "Space Grotesk", system-ui, sans-serif';
  ctx.fillStyle = '#C8F031';
  ctx.fillText('82,5', x + 32, boxY + 72);

  roundRect(ctx, x + 30 + boxW, boxY, boxW, 96, 16);
  ctx.fillStyle = '#1A1F2B';
  ctx.fill();
  ctx.font = '500 11px "JetBrains Mono", monospace';
  ctx.fillStyle = '#7C849B';
  ctx.fillText('TEKRAR', x + 44 + boxW, boxY + 26);
  ctx.font = '700 34px "Space Grotesk", system-ui, sans-serif';
  ctx.fillStyle = '#EEF1F6';
  ctx.fillText('10', x + 44 + boxW, boxY + 72);

  const btnY = boxY + 114;
  if (!resting) {
    roundRect(ctx, x + 18, btnY, w - 36, 56, 16);
    ctx.fillStyle = '#C8F031';
    ctx.fill();
    ctx.font = '700 17px "Space Grotesk", system-ui, sans-serif';
    ctx.fillStyle = '#0A0D14';
    ctx.textAlign = 'center';
    ctx.fillText('Seti tamamladım', x + w / 2, btnY + 35);
    ctx.textAlign = 'left';
  } else {
    roundRect(ctx, x + 18, btnY, w - 36, 56, 16);
    ctx.fillStyle = 'rgba(200,240,49,0.16)';
    ctx.fill();
    ctx.strokeStyle = '#C8F031';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const restSec = Math.max(72, Math.ceil(90 - (progress - 0.52) * 35));
    ctx.font = '700 18px "JetBrains Mono", monospace';
    ctx.fillStyle = '#C8F031';
    ctx.textAlign = 'center';
    ctx.fillText(`DİNLENME SAYACI · 01:${String(restSec - 60).padStart(2, '0')}`, x + w / 2, btnY + 35);
    ctx.textAlign = 'left';
  }

  const listY = setY + 256;
  drawPhoneCard(ctx, x, listY, w, 134);
  ctx.font = '500 11px "JetBrains Mono", monospace';
  ctx.fillStyle = '#7C849B';
  ctx.fillText('SIRADAKİ HAREKETLER', x + 18, listY + 26);

  const items = [
    { idx: '2', name: 'Incline Dumbbell Press', sets: '3 × 10-12' },
    { idx: '3', name: 'Lat Pulldown (Geniş)', sets: '4 × 8-10' },
    { idx: '4', name: 'Seated Cable Row', sets: '3 × 10-12' },
  ];
  items.forEach((it, i) => {
    const iy = listY + 52 + i * 28;
    ctx.font = '600 13px "JetBrains Mono", monospace';
    ctx.fillStyle = '#C8F031';
    ctx.fillText(it.idx, x + 18, iy);
    ctx.font = '500 14px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#EEF1F6';
    ctx.fillText(it.name, x + 38, iy);
    ctx.font = '500 12px "JetBrains Mono", monospace';
    ctx.fillStyle = '#7C849B';
    ctx.textAlign = 'right';
    ctx.fillText(it.sets, x + w - 18, iy);
    ctx.textAlign = 'left';
  });

  return sugY + 39;
}

function drawProgressScreen(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  progress: number,
): number {
  ctx.font = '500 12px "JetBrains Mono", monospace';
  ctx.fillStyle = '#7C849B';
  ctx.fillText('GELİŞİMİM & İSTATİSTİK', x, y + 14);

  ctx.font = '700 26px "Space Grotesk", system-ui, sans-serif';
  ctx.fillStyle = '#EEF1F6';
  ctx.fillText('4 Haftalık Analiz', x, y + 46);

  const trY = y + 64;
  drawPhoneCard(ctx, x, trY, w, 68, 'rgba(238,241,246,0.35)', 'rgba(238,241,246,0.10)');
  ctx.font = '600 11px "JetBrains Mono", monospace';
  ctx.fillStyle = '#EEF1F6';
  ctx.fillText('EĞİTMENİN ATADI · CANLI TAKİP', x + 16, trY + 24);
  ctx.font = '600 15px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#EEF1F6';
  ctx.fillText('Hakan Koç · Hipertrofi Üst / Alt (4 Gün)', x + 16, trY + 48);

  const volY = trY + 84;
  drawPhoneCard(ctx, x, volY, w, 190);
  ctx.font = '500 11px "JetBrains Mono", monospace';
  ctx.fillStyle = '#7C849B';
  ctx.fillText('HAFTALIK TOPLAM HACİM (TONAJ)', x + 18, volY + 26);

  ctx.font = '700 24px "Space Grotesk", system-ui, sans-serif';
  ctx.fillStyle = '#C8F031';
  ctx.fillText('14.920 kg', x + 18, volY + 56);
  drawPill(ctx, x + w - 118, volY + 34, '+%16 ARTIŞ', '#C8F031', 'rgba(200,240,49,0.16)');

  const weeks = [
    { label: 'H1', val: 11400 },
    { label: 'H2', val: 12650 },
    { label: 'H3', val: 13800 },
    { label: 'Bu hafta', val: 14920 },
  ];
  const bw = (w - 72) / 4;
  weeks.forEach((wk, idx) => {
    const anim = easeOutCubic(clamp(progress * 2.4 - idx * 0.12, 0, 1));
    const bh = (wk.val / 16000) * 78 * anim;
    const bx = x + 18 + idx * (bw + 12);
    const by = volY + 154 - bh;
    roundRect(ctx, bx, by, bw, Math.max(8, bh), 8);
    ctx.fillStyle = idx === 3 ? '#C8F031' : '#1A1F2B';
    ctx.fill();
    ctx.font = '500 11px "JetBrains Mono", monospace';
    ctx.fillStyle = idx === 3 ? '#C8F031' : '#7C849B';
    ctx.textAlign = 'center';
    ctx.fillText(wk.label, bx + bw / 2, volY + 174);
  });
  ctx.textAlign = 'left';

  const lineY = volY + 206;
  drawPhoneCard(ctx, x, lineY, w, 170);
  ctx.font = '500 11px "JetBrains Mono", monospace';
  ctx.fillStyle = '#7C849B';
  ctx.fillText('BENCH PRESS · EN YÜKSEK AĞIRLIK', x + 18, lineY + 26);

  const pts = [
    { x: x + 34, y: lineY + 128, label: '75 kg' },
    { x: x + 34 + (w - 68) * 0.33, y: lineY + 106, label: '77,5' },
    { x: x + 34 + (w - 68) * 0.66, y: lineY + 82, label: '80' },
    { x: x + w - 34, y: lineY + 56, label: '82,5 PR' },
  ];
  ctx.strokeStyle = '#C8F031';
  ctx.lineWidth = 3;
  ctx.beginPath();
  pts.forEach((pt, i) => {
    if (i === 0) ctx.moveTo(pt.x, pt.y);
    else ctx.lineTo(pt.x, pt.y);
  });
  ctx.stroke();

  pts.forEach((pt, i) => {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, i === 3 ? 6 : 4.5, 0, Math.PI * 2);
    ctx.fillStyle = i === 3 ? '#C8F031' : '#C8F031';
    ctx.fill();
    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.fillStyle = i === 3 ? '#C8F031' : '#9BA3B8';
    ctx.textAlign = 'center';
    ctx.fillText(pt.label, pt.x, pt.y - 12);
  });
  ctx.textAlign = 'left';

  return volY + 95;
}

function drawBuddyScreen(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  progress: number,
): number {
  const matched = progress > 0.48;

  ctx.font = '500 12px "JetBrains Mono", monospace';
  ctx.fillStyle = '#C8F031';
  ctx.fillText('SALON İÇİ RADAR · 24 ÜYE İÇERİDE', x, y + 14);

  ctx.font = '700 26px "Space Grotesk", system-ui, sans-serif';
  ctx.fillStyle = '#EEF1F6';
  ctx.fillText('Spotter & Buddy', x, y + 46);

  const p1Y = y + 66;
  drawPhoneCard(
    ctx,
    x,
    p1Y,
    w,
    176,
    matched ? 'rgba(200,240,49,0.45)' : 'rgba(200,240,49,0.35)',
  );

  roundRect(ctx, x + 18, p1Y + 18, 42, 42, 12);
  ctx.fillStyle = '#C8F031';
  ctx.fill();
  ctx.font = '700 16px "Space Grotesk", system-ui, sans-serif';
  ctx.fillStyle = '#0A0D14';
  ctx.textAlign = 'center';
  ctx.fillText('BB', x + 39, p1Y + 45);
  ctx.textAlign = 'left';

  ctx.font = '700 18px "Space Grotesk", system-ui, sans-serif';
  ctx.fillStyle = '#EEF1F6';
  ctx.fillText('Burak B.', x + 72, p1Y + 36);

  ctx.font = '500 12px "JetBrains Mono", monospace';
  ctx.fillStyle = '#C8F031';
  ctx.fillText('GÖĞÜS · SERBEST AĞIRLIK ALANI', x + 72, p1Y + 54);

  ctx.font = '400 14px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#EEF1F6';
  ctx.fillText('"Bench press 100 kg son 2 set için spotter', x + 18, p1Y + 86);
  ctx.fillText('arıyorum, 2. sehpadayım."', x + 18, p1Y + 106);

  roundRect(ctx, x + 18, p1Y + 122, w - 36, 40, 12);
  ctx.fillStyle = matched ? '#C8F031' : '#C8F031';
  ctx.fill();
  ctx.font = '700 14px "Space Grotesk", system-ui, sans-serif';
  ctx.fillStyle = '#0A0D14';
  ctx.textAlign = 'center';
  ctx.fillText(matched ? 'Eşleşildi · Sohbet Açık' : 'Spot isteği gönder', x + w / 2, p1Y + 147);
  ctx.textAlign = 'left';

  const p2Y = p1Y + 192;
  if (matched) {
    drawPhoneCard(ctx, x, p2Y, w, 218, 'rgba(200,240,49,0.35)');
    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.fillStyle = '#C8F031';
    ctx.fillText('CANLI EŞLEŞME SOHBETİ · BURAK B.', x + 18, p2Y + 26);

    roundRect(ctx, x + 18, p2Y + 44, w - 70, 56, 14);
    ctx.fillStyle = '#1A1F2B';
    ctx.fill();
    ctx.font = '400 13px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#EEF1F6';
    ctx.fillText('Burak B.: Süper, 2. bench sehpasındayım!', x + 30, p2Y + 68);
    ctx.fillStyle = '#7C849B';
    ctx.fillText('Şimdi · Salondan çıkınca sohbet kapanır', x + 30, p2Y + 88);

    roundRect(ctx, x + 52, p2Y + 114, w - 70, 46, 14);
    ctx.fillStyle = 'rgba(200,240,49,0.18)';
    ctx.fill();
    ctx.font = '500 13px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#C8F031';
    ctx.fillText('Sen: Geliyorum, 1 dakikaya oradayım!', x + 66, p2Y + 142);

    drawPill(ctx, x + 18, p2Y + 174, 'Geliyorum', '#EEF1F6', '#1A1F2B');
    drawPill(ctx, x + 118, p2Y + 174, '2 dk bekle', '#EEF1F6', '#1A1F2B');
  } else {
    drawPhoneCard(ctx, x, p2Y, w, 150);
    ctx.font = '700 17px "Space Grotesk", system-ui, sans-serif';
    ctx.fillStyle = '#EEF1F6';
    ctx.fillText('Kerem K.', x + 18, p2Y + 34);
    ctx.font = '500 11px "JetBrains Mono", monospace';
    ctx.fillStyle = '#EEF1F6';
    ctx.fillText('BACAK · SQUAT RACK #1', x + 18, p2Y + 54);
    ctx.font = '400 13px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#9BA3B8';
    ctx.fillText('"Squat 120 kg 5 tekrar için güvenlik', x + 18, p2Y + 82);
    ctx.fillText('bekçisi arıyorum."', x + 18, p2Y + 102);
  }

  return p1Y + 88;
}

function drawAiFormScreen(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  progress: number,
  globalTime: number,
): number {
  ctx.font = '500 12px "JetBrains Mono", monospace';
  ctx.fillStyle = '#C8F031';
  ctx.fillText('YAPAY ZEKA FORM KOÇU · MEDIAPIPE', x, y + 14);

  ctx.font = '700 25px "Space Grotesk", system-ui, sans-serif';
  ctx.fillStyle = '#EEF1F6';
  ctx.fillText('Barbell Squat Analizi', x, y + 46);

  const camY = y + 64;
  const camH = 294;
  drawPhoneCard(ctx, x, camY, w, camH, 'rgba(200,240,49,0.35)', '#0D121C');

  const squatPhase = (Math.sin(globalTime * 2.8) + 1) / 2;
  const kneeAngle = Math.round(86 + squatPhase * 84);
  const deepEnough = kneeAngle <= 100;

  const cx = x + w * 0.52;
  const ankleX = cx - 12;
  const ankleY = camY + camH - 38;
  const kneeX = cx - 44 - (1 - squatPhase) * 22;
  const kneeY = ankleY - 64;
  const hipX = cx + 10 + (1 - squatPhase) * 26;
  const hipY = kneeY - 18 - squatPhase * 52;
  const shoulderX = cx - 18 + (1 - squatPhase) * 14;
  const shoulderY = hipY - 76;
  const headX = shoulderX - 4;
  const headY = shoulderY - 26;

  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(shoulderX - 36, shoulderY);
  ctx.lineTo(shoulderX + 36, shoulderY);
  ctx.stroke();

  ctx.strokeStyle = deepEnough ? '#C8F031' : '#C8F031';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(headX, headY);
  ctx.lineTo(shoulderX, shoulderY);
  ctx.lineTo(hipX, hipY);
  ctx.lineTo(kneeX, kneeY);
  ctx.lineTo(ankleX, ankleY);
  ctx.stroke();

  const joints: [number, number][] = [
    [headX, headY],
    [shoulderX, shoulderY],
    [hipX, hipY],
    [kneeX, kneeY],
    [ankleX, ankleY],
  ];
  for (const [jx, jy] of joints) {
    ctx.beginPath();
    ctx.arc(jx, jy, 6.5, 0, Math.PI * 2);
    ctx.fillStyle = '#0A0D14';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = deepEnough ? '#C8F031' : '#C8F031';
    ctx.stroke();
  }

  roundRect(ctx, kneeX - 78, kneeY - 22, 66, 30, 10);
  ctx.fillStyle = 'rgba(10, 13, 20, 0.88)';
  ctx.fill();
  ctx.font = '700 14px "JetBrains Mono", monospace';
  ctx.fillStyle = deepEnough ? '#C8F031' : '#C8F031';
  ctx.fillText(`${kneeAngle}°`, kneeX - 64, kneeY - 2);

  drawPill(
    ctx,
    x + 14,
    camY + 14,
    deepEnough ? 'TAM DERİNLİK (ONAY)' : 'İNİŞ FAZI',
    deepEnough ? '#C8F031' : '#C8F031',
    'rgba(10,13,20,0.85)',
  );

  const metY = camY + camH + 14;
  const mw = (w - 12) / 2;
  drawPhoneCard(ctx, x, metY, mw, 92);
  ctx.font = '500 11px "JetBrains Mono", monospace';
  ctx.fillStyle = '#7C849B';
  ctx.fillText('GEÇERLİ TEKRAR', x + 16, metY + 26);
  const reps = Math.min(8, 4 + Math.floor(progress * 5));
  ctx.font = '700 32px "Space Grotesk", system-ui, sans-serif';
  ctx.fillStyle = '#C8F031';
  ctx.fillText(`${reps}`, x + 16, metY + 68);
  ctx.font = '500 12px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#7C849B';
  ctx.fillText('Yarım: 0', x + 58, metY + 66);

  drawPhoneCard(ctx, x + mw + 12, metY, mw, 92);
  ctx.font = '500 11px "JetBrains Mono", monospace';
  ctx.fillStyle = '#7C849B';
  ctx.fillText('EN DİP AÇI & HIZ', x + mw + 28, metY + 26);
  ctx.font = '700 28px "Space Grotesk", system-ui, sans-serif';
  ctx.fillStyle = '#C8F031';
  ctx.fillText('86°', x + mw + 28, metY + 66);
  ctx.font = '500 12px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#C8F031';
  ctx.fillText('-%6 hız', x + mw + 84, metY + 64);

  return camY + camH * 0.55;
}

function drawCrmCalendarScreen(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  _progress: number,
): number {
  ctx.font = '500 12px "JetBrains Mono", monospace';
  ctx.fillStyle = '#EEF1F6';
  ctx.fillText('SAYNOVRA CRM · TAKVİM & KASA', x, y + 14);
  ctx.font = '700 26px "Space Grotesk", system-ui, sans-serif';
  ctx.fillStyle = '#EEF1F6';
  ctx.fillText('Ekim 2026 Planı', x, y + 46);

  const c1 = y + 66;
  drawPhoneCard(ctx, x, c1, w, 146, 'rgba(238,241,246,0.35)');
  ctx.font = '500 11px "JetBrains Mono", monospace';
  ctx.fillStyle = '#7C849B';
  ctx.fillText('TOPLAM SÖZLEŞME TUTARI', x + 18, c1 + 28);
  ctx.font = '700 34px "Space Grotesk", system-ui, sans-serif';
  ctx.fillStyle = '#EEF1F6';
  ctx.fillText('550.000 TL', x + 18, c1 + 70);
  drawPill(ctx, x + 18, c1 + 92, 'Tahsilat: 145.000 TL', '#C8F031', 'rgba(200,240,49,0.16)');
  drawPill(ctx, x + 204, c1 + 92, 'Kalan: 405.000 TL', '#C8F031', 'rgba(200,240,49,0.16)');

  const c2 = c1 + 164;
  drawPhoneCard(ctx, x, c2, w, 260);
  ctx.font = '700 17px "Space Grotesk", system-ui, sans-serif';
  ctx.fillStyle = '#EEF1F6';
  ctx.fillText('Aktif Randevu & Etkinlikler', x + 18, c2 + 32);
  for (let r = 0; r < 4; r++) {
    const ry = c2 + 54 + r * 48;
    roundRect(ctx, x + 18, ry, w - 36, 40, 10);
    ctx.fillStyle = r === 1 ? 'rgba(200,240,49,0.16)' : '#1A1F2B';
    ctx.fill();
    ctx.font = '600 13px Inter, system-ui, sans-serif';
    ctx.fillStyle = r === 1 ? '#C8F031' : '#EEF1F6';
    ctx.fillText(`${10 + r * 4} Ekim · Kurumsal Organizasyon #${r + 1}`, x + 30, ry + 25);
  }
  return c2 + 95;
}

function drawMobileMenuScreen(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  _progress: number,
): number {
  ctx.font = '500 12px "JetBrains Mono", monospace';
  ctx.fillStyle = '#C8F031';
  ctx.fillText('KURUMSAL WEB · MOBİL ARAYÜZ', x, y + 14);
  ctx.font = '700 26px "Space Grotesk", system-ui, sans-serif';
  ctx.fillStyle = '#EEF1F6';
  ctx.fillText('Hızlı Mobil Menü', x, y + 46);

  const items = ['Ana Sayfa', 'Hizmetlerimiz', 'Organizasyonlar', 'Referanslar', 'İletişim & Teklif'];
  items.forEach((label, idx) => {
    const iy = y + 72 + idx * 68;
    drawPhoneCard(ctx, x, iy, w, 56, idx === 2 ? '#C8F031' : 'rgba(255,255,255,0.08)');
    ctx.font = '700 17px "Space Grotesk", system-ui, sans-serif';
    ctx.fillStyle = idx === 2 ? '#C8F031' : '#EEF1F6';
    ctx.fillText(label, x + 22, iy + 34);
  });
  return y + 168;
}

function drawRtlWebScreen(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  _progress: number,
): number {
  ctx.font = '500 12px "JetBrains Mono", monospace';
  ctx.fillStyle = '#FF5A4F';
  ctx.fillText('ÇOK DİLLİ SİSTEM · AR / TR / EN', x, y + 14);
  ctx.font = '700 26px "Space Grotesk", system-ui, sans-serif';
  ctx.fillStyle = '#EEF1F6';
  ctx.fillText('Sağdan Sola (RTL)', x, y + 46);

  const heroY = y + 68;
  drawPhoneCard(ctx, x, heroY, w, 240, 'rgba(255,90,79,0.45)', 'rgba(140,25,35,0.35)');
  ctx.textAlign = 'right';
  ctx.font = '700 22px "Space Grotesk", system-ui, sans-serif';
  ctx.fillStyle = '#EEF1F6';
  ctx.fillText('خدمات الترجمة الاحترافية', x + w - 22, heroY + 48);
  ctx.font = '500 15px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#E2E8F0';
  ctx.fillText('Tüm Dünya Dillerinde Profesyonel', x + w - 22, heroY + 82);
  ctx.fillText('ve Yeminli Tercüme Hizmetleri', x + w - 22, heroY + 106);
  ctx.textAlign = 'left';

  roundRect(ctx, x + 22, heroY + 168, w - 44, 48, 14);
  ctx.fillStyle = '#FF5A4F';
  ctx.fill();
  ctx.font = '700 15px "Space Grotesk", system-ui, sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.fillText('Hemen Teklif Alın · اطلب عرض سعر', x + w / 2, heroY + 198);
  ctx.textAlign = 'left';
  return heroY + 120;
}

function drawOutroCard(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  config: ReelConfig,
  outroProgress: number,
  globalTime: number,
): void {
  drawSpaceBackground(ctx, w, h, globalTime, 0.5, 'right');

  // Dark overlay for crisp text readability on outro
  ctx.fillStyle = 'rgba(6, 8, 14, 0.6)';
  ctx.fillRect(0, 0, w, h);

  const enter = easeOutCubic(clamp(outroProgress * 2.5, 0, 1));
  ctx.save();
  ctx.globalAlpha = enter;

  const logoY = h * 0.34;
  drawSaynovraLogo(ctx, w / 2, logoY, 190, globalTime);

  ctx.textAlign = 'center';
  ctx.font = '700 80px "Space Grotesk", system-ui, sans-serif';
  ctx.letterSpacing = '-2.8px';
  ctx.fillStyle = '#EEF1F6';
  ctx.fillText(config.brandName, w / 2, logoY + 185);

  ctx.font = '500 22px "JetBrains Mono", monospace';
  ctx.letterSpacing = '3px';
  ctx.fillStyle = '#7C849B';
  ctx.fillText('SOFTWARE • AI • AUTOMATION', w / 2, logoY + 235);
  ctx.letterSpacing = '0px';

  const pillW = 460;
  roundRect(ctx, (w - pillW) / 2, logoY + 275, pillW, 58, 29);
  ctx.fillStyle = 'rgba(200, 240, 49, 0.16)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(200, 240, 49, 0.45)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = '700 25px "Space Grotesk", system-ui, sans-serif';
  ctx.fillStyle = '#C8F031';
  ctx.fillText(`${config.productTitle} · Spor Salonu Sistemi`, w / 2, logoY + 312);

  ctx.font = '700 44px "Space Grotesk", system-ui, sans-serif';
  ctx.letterSpacing = '-1.2px';
  ctx.fillStyle = '#EEF1F6';
  ctx.fillText(config.brandTagline, w / 2, h * 0.78);
  ctx.letterSpacing = '0px';

  ctx.font = '700 32px "JetBrains Mono", monospace';
  ctx.fillStyle = '#C8F031';
  ctx.fillText(config.brandWebsite, w / 2, h * 0.835);

  ctx.textAlign = 'left';
  ctx.restore();
}

/**
 * Main entry point: renders a single frame at `timeSec` for any aspect ratio (default 1080x1350 4:5 Post).
 * - Top segmented story bars REMOVED!
 * - Lunar surface + animated astronaut in the background!
 * - Larger, CENTERED headlines & card text!
 */
export function renderReelFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  timeSec: number,
  config: ReelConfig,
  options?: { showSafeGrid?: boolean; customImages?: Record<string, HTMLImageElement> },
): void {
  const totalSceneSec = config.scenes.reduce((a, s) => a + s.durationSec, 0);
  const clampedTime = clamp(timeSec, 0, totalSceneSec + config.outroDurationSec);

  if (clampedTime >= totalSceneSec && config.outroDurationSec > 0) {
    const outroProg = (clampedTime - totalSceneSec) / config.outroDurationSec;
    drawOutroCard(ctx, w, h, config, outroProg, clampedTime);
    drawFilmFinish(ctx, w, h, clampedTime);
    if (options?.showSafeGrid) drawSafeZoneOverlay(ctx, w, h);
    return;
  }

  let acc = 0;
  let activeScene: ReelScene = config.scenes[0] ?? DEFAULT_REEL_CONFIG.scenes[0]!;
  for (let i = 0; i < config.scenes.length; i++) {
    const sc = config.scenes[i];
    if (!sc) continue;
    if (clampedTime < acc + sc.durationSec || i === config.scenes.length - 1) {
      activeScene = sc;
      break;
    }
    acc += sc.durationSec;
  }
  const sceneElapsed = clampedTime - acc;
  const sceneProgress = clamp(sceneElapsed / activeScene.durationSec, 0, 1);
  const accentColor = activeScene.accentColor ?? '#C8F031';
  const phoneOnRight = activeScene.phonePosition === 'right';

  // 1. Lunar Surface + Animated Astronaut Background (Astronaut placed on the side opposite the phone!)
  drawSpaceBackground(ctx, w, h, clampedTime, sceneProgress, phoneOnRight ? 'left' : 'right');

  // 2. Centered Brand Header & Badge (NO top progress bars!)
  const headerY = h >= 1700 ? 86 : 56;
  drawSaynovraLogo(ctx, w / 2 - 175, headerY, 44, clampedTime, accentColor);

  ctx.textAlign = 'left';
  ctx.font = '700 22px "Space Grotesk", system-ui, sans-serif';
  ctx.fillStyle = '#EEF1F6';
  ctx.fillText(config.brandName, w / 2 - 138, headerY - 2);
  ctx.font = '500 13px "JetBrains Mono", monospace';
  ctx.letterSpacing = '1.8px';
  ctx.fillStyle = accentColor;
  ctx.fillText(config.productTitle, w / 2 - 138, headerY + 16);
  ctx.letterSpacing = '0px';

  ctx.font = '500 14px "JetBrains Mono", monospace';
  ctx.letterSpacing = '2px';
  const badgeW = ctx.measureText(activeScene.badgeText).width + 32;
  roundRect(ctx, w / 2 + 24, headerY - 20, badgeW, 38, 19);
  ctx.fillStyle = 'rgba(200, 240, 49, 0.15)';
  ctx.fill();
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = accentColor;
  ctx.textAlign = 'center';
  ctx.fillText(activeScene.badgeText, w / 2 + 24 + badgeW / 2, headerY + 4);
  ctx.letterSpacing = '0px';
  ctx.textAlign = 'left';

  // 3. LARGER, CENTERED @saynovra Headline (White + Accent Line)
  const headEnter = easeOutCubic(clamp(sceneProgress * 3.5, 0, 1));
  ctx.save();
  ctx.globalAlpha = headEnter;
  ctx.textAlign = 'center';
  const headBaseY = (h >= 1700 ? 215 : 152) + (1 - headEnter) * 20;

  ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
  ctx.shadowBlur = 24;
  ctx.font = '700 76px "Space Grotesk", system-ui, sans-serif';
  ctx.letterSpacing = '-2.6px';
  ctx.fillStyle = '#EEF1F6';
  ctx.fillText(activeScene.headlineTop, w / 2, headBaseY);

  ctx.fillStyle = accentColor;
  ctx.fillText(activeScene.headlineAccent, w / 2, headBaseY + 80);
  ctx.letterSpacing = '0px';
  ctx.restore();
  ctx.textAlign = 'left';

  // 4. Phone Mockup & Floating @saynovra Callout Card (Adapted to 4:5 1080x1350 or 9:16 1080x1920)
  const isTall = h >= 1700;
  const phoneW = isTall ? 490 : 446;
  const phoneH = isTall ? 1000 : 880;
  const floatOffset = Math.sin(clampedTime * 1.8) * 7;
  const enterShift = (1 - easeInOutCubic(clamp(sceneProgress * 2.8, 0, 1))) * 40;

  const phoneX = phoneOnRight ? w - phoneW - 48 + enterShift : 48 - enterShift;
  const phoneY = (isTall ? 430 : 290) + floatOffset;

  const customImg = options?.customImages?.[activeScene.id] ?? null;

  const { highlightX, highlightY } = drawPhoneMockup(
    ctx,
    phoneX,
    phoneY,
    phoneW,
    phoneH,
    activeScene.screen,
    sceneProgress,
    clampedTime,
    customImg,
  );

  // Place Callout Card below the astronaut so BOTH the astronaut on the moon AND the card are clearly visible!
  const cardW = 486;
  const cardX = phoneOnRight ? 46 : w - cardW - 46;
  const cardY = (isTall ? 1040 : 815) - floatOffset * 0.5;

  drawCalloutCard(
    ctx,
    cardX,
    cardY,
    cardW,
    activeScene.cardTitle,
    activeScene.cardBody,
    activeScene.cardSubtag,
    sceneProgress,
    highlightX,
    highlightY,
    accentColor,
  );

  // 5. Centered Bottom @saynovra Pill Bar
  const footerY = h - (isTall ? 106 : 78);
  const pillWidths: number[] = [];
  ctx.font = '600 20px Inter, system-ui, sans-serif';
  for (const p of config.pills) {
    pillWidths.push(ctx.measureText(p).width + 42);
  }
  ctx.font = '700 20px "JetBrains Mono", monospace';
  const webW = ctx.measureText(config.brandWebsite).width + 46;

  const totalFooterW = pillWidths.reduce((a, b) => a + b, 0) + webW + 14 * config.pills.length;
  let pillCursorX = (w - totalFooterW) / 2;

  config.pills.forEach((pillText, idx) => {
    const pw = pillWidths[idx] ?? 140;
    roundRect(ctx, pillCursorX, footerY, pw, 48, 24);
    ctx.fillStyle = 'rgba(14, 18, 27, 0.92)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.font = '600 20px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#EEF1F6';
    ctx.textAlign = 'center';
    ctx.fillText(pillText, pillCursorX + pw / 2, footerY + 31);
    pillCursorX += pw + 14;
  });

  roundRect(ctx, pillCursorX, footerY, webW, 48, 24);
  ctx.fillStyle = accentColor;
  ctx.fill();
  ctx.font = '700 20px "JetBrains Mono", monospace';
  ctx.fillStyle = '#0A0D14';
  ctx.textAlign = 'center';
  ctx.fillText(config.brandWebsite, pillCursorX + webW / 2, footerY + 31);
  ctx.textAlign = 'left';

  drawFilmFinish(ctx, w, h, clampedTime);
  if (options?.showSafeGrid) {
    drawSafeZoneOverlay(ctx, w, h);
  }
}

function drawSafeZoneOverlay(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.save();
  const sqTop = (h - w) / 2;
  ctx.strokeStyle = 'rgba(200, 240, 49, 0.7)';
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 10]);
  ctx.strokeRect(12, sqTop, w - 24, w);

  roundRect(ctx, w / 2 - 190, sqTop + 14, 380, 38, 10);
  ctx.fillStyle = 'rgba(10, 13, 20, 0.9)';
  ctx.fill();
  ctx.font = '600 15px "JetBrains Mono", monospace';
  ctx.fillStyle = '#C8F031';
  ctx.textAlign = 'center';
  ctx.fillText('INSTAGRAM PROFİL 1:1 KARESİ', w / 2, sqTop + 38);
  ctx.textAlign = 'left';
  ctx.restore();
}
