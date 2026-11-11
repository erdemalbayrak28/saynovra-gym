export type AspectRatioMode = '9:16' | '4:5' | '1:1';
export type AtmosphereTheme = 'ocean' | 'cosmic' | 'bokeh' | 'midnight' | 'crimson' | 'noir';
export type DeviceType = 'iphone' | 'macbook' | 'monitor' | 'dual' | 'typography';
export type DeviceLayout = 'right' | 'left' | 'center';
export type BuiltinScreenId =
  | 'novra-home'
  | 'novra-qr'
  | 'novra-workout'
  | 'novra-progress'
  | 'novra-buddy'
  | 'novra-aiform'
  | 'saynovra-crm-calendar'
  | 'saynovra-dashboard'
  | 'saynovra-rtl-web'
  | 'saynovra-mobile-menu';

export type MediaScrollMode = 'none' | 'scroll-down' | 'zoom-in';

export interface StudioScene {
  id: string;
  name: string;
  durationSec: number;
  theme: AtmosphereTheme;
  accentColor: string;
  deviceType: DeviceType;
  deviceLayout: DeviceLayout;
  builtinScreen: BuiltinScreenId;
  /** Optional custom uploaded image or video data URL / object URL */
  customMediaUrl?: string;
  customMediaType?: 'image' | 'video';
  mediaScrollMode: MediaScrollMode;
  badgeText: string;
  headlineTop: string;
  headlineAccent: string;
  /** Whether to show the floating @saynovra Red/Yellow/Green glass callout card */
  showCalloutCard: boolean;
  cardTitle: string;
  cardBody: string;
  cardSubtag: string;
  /** Show dashed pointer line from card to target point on device */
  showPointerLine: boolean;
  /** Normalized (0..1) target coordinates on the canvas where the pointer dot sits */
  pointerTargetX: number;
  pointerTargetY: number;
  /** Optional bottom caption for Monitor / Laptop showcase (like "Kontrol" post) */
  bottomCenterCaption?: string;
}

export interface StudioProject {
  id: string;
  title: string;
  aspectRatio: AspectRatioMode;
  fps: 24 | 30;
  brandName: string;
  brandSubtitle: string;
  brandTagline: string;
  brandWebsite: string;
  showHeaderLogo: boolean;
  showFooterPills: boolean;
  pills: [string, string, string];
  includeOutro: boolean;
  outroDurationSec: number;
  scenes: StudioScene[];
}

export const ASPECT_DIMENSIONS: Record<AspectRatioMode, { width: number; height: number; label: string }> = {
  '9:16': { width: 1080, height: 1920, label: '9:16 Reels / Story (1080×1920)' },
  '4:5': { width: 1080, height: 1350, label: '4:5 Dikey Gönderi (1080×1350)' },
  '1:1': { width: 1080, height: 1080, label: '1:1 Kare Gönderi (1080×1080)' },
};

export const ACCENT_PRESETS: { label: string; hex: string }[] = [
  { label: 'Novra Lime', hex: '#C8F031' },
  { label: 'Zümrüt Onay', hex: '#2EE59D' },
  { label: 'Siber Mavi', hex: '#4DB8FF' },
  { label: 'Altın Sarısı', hex: '#F59E0B' },
  { label: 'Mercan Kırmızı', hex: '#FF5A4F' },
  { label: 'Kozmik Mor', hex: '#A855F7' },
];

