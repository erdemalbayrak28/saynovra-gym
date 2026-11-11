import {
  Camera,
  Download,
  Grid,
  ImagePlus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Video,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, Label } from '../components/ui';
import {
  ASPECT_SIZES,
  DEFAULT_REEL_CONFIG,
  getTotalDuration,
  renderReelFrame,
  type AspectRatioPreset,
  type AtmosphereTheme,
  type PhonePosition,
  type ReelConfig,
  type ReelScene,
  type ScreenKind,
} from '../lib/reelRenderer';
import { loadReelAssets } from '../lib/reelBackground';

const STORAGE_KEY = 'novra:reel-config:v2';

const THEME_LABELS: Record<AtmosphereTheme, string> = {
  'moon-walk': '🧑‍🚀 Ay Yüzeyinde Yürüyüş & Keşif',
  'moon-flag': '🚩 Ay Üssüne SAYNOVRA Bayrağı Dikme',
  'moon-lift': '🏋️ Ay Yerçekiminde Halter Kaldırma',
  'moon-laptop': '💻 Ay Yüzeyinde Hologram Bilgisayar',
  'moon-radar': '📡 Ay Radarı & Selamlaşan Astronot',
  'moon-reach': '✨ Uzayda Süzülüp Kameraya Uzanma',
};

const SCREEN_LABELS: Record<ScreenKind, string> = {
  home: 'NOVRA GYM · Canlı Salon & Yoğunluk',
  qr: 'NOVRA GYM · Kriptografik QR & Turnike',
  workout: 'NOVRA GYM · Akıllı Antrenman (+2,5 kg)',
  progress: 'NOVRA GYM · 4 Haftalık Gelişim & Tonaj',
  buddy: 'NOVRA GYM · Salon İçi Spotter Radarı',
  aiform: 'NOVRA GYM · Kamera ile AI Form Analizi',
  'crm-calendar': 'SAYNOVRA · CRM & Randevu Takvimi',
  'mobile-menu': 'SAYNOVRA · Hızlı Mobil Menü',
  'rtl-web': 'SAYNOVRA · Sağdan Sola (RTL) Tercüme Web',
  dashboard: 'SAYNOVRA · Yönetim Paneli',
};

const ACCENT_COLORS = [
  { label: 'Novra Lime', hex: '#C8F031' },
  { label: 'Zümrüt Onay', hex: '#2EE59D' },
  { label: 'Siber Mavi', hex: '#4DB8FF' },
  { label: 'Mercan Kırmızı', hex: '#FF5A4F' },
  { label: 'Altın Sarısı', hex: '#F59E0B' },
];

function loadConfig(): ReelConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_REEL_CONFIG;
    const parsed = JSON.parse(raw) as ReelConfig;
    if (!parsed.scenes || !Array.isArray(parsed.scenes)) return DEFAULT_REEL_CONFIG;
    return { ...DEFAULT_REEL_CONFIG, ...parsed };
  } catch {
    return DEFAULT_REEL_CONFIG;
  }
}

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export function ReelStudio() {
  const [config, setConfig] = useState<ReelConfig>(loadConfig);
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [playing, setPlaying] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [showSafeGrid, setShowSafeGrid] = useState<boolean>(false);
  const [recording, setRecording] = useState<boolean>(false);
  const [recordProgress, setRecordProgress] = useState<number>(0);
  const [customImages, setCustomImages] = useState<Record<string, HTMLImageElement>>({});
  const [assetsReady, setAssetsReady] = useState<boolean>(false);

  // Background artwork and brand fonts; the canvas redraws once both are in.
  useEffect(() => {
    let alive = true;
    Promise.all([loadReelAssets(), document.fonts.ready])
      .catch((err: unknown) => console.error('Reel assets failed to load', err))
      .finally(() => alive && setAssetsReady(true));
    return () => {
      alive = false;
    };
  }, []);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastTickRef = useRef<number | null>(null);

  const dims = ASPECT_SIZES[config.aspectRatio ?? '4:5'];
  const totalDuration = useMemo(() => getTotalDuration(config), [config]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      // Ignore quota errors
    }
  }, [config]);

  // Load any custom images attached to scenes
  useEffect(() => {
    config.scenes.forEach((sc) => {
      if (sc.customImageUrl && !customImages[sc.id]) {
        const img = new Image();
        img.onload = () => {
          setCustomImages((prev) => ({ ...prev, [sc.id]: img }));
        };
        img.src = sc.customImageUrl;
      }
    });
  }, [config.scenes, customImages]);

  const sceneOffsets = useMemo(() => {
    const offsets: number[] = [];
    let acc = 0;
    for (const s of config.scenes) {
      offsets.push(acc);
      acc += s.durationSec;
    }
    return offsets;
  }, [config.scenes]);

  const activeSceneIndex = useMemo(() => {
    let acc = 0;
    for (let i = 0; i < config.scenes.length; i++) {
      const sc = config.scenes[i];
      if (!sc) continue;
      if (currentTime < acc + sc.durationSec) return i;
      acc += sc.durationSec;
    }
    return config.scenes.length;
  }, [config.scenes, currentTime]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderReelFrame(ctx, dims.width, dims.height, currentTime, config, {
      showSafeGrid: showSafeGrid && !recording,
      customImages,
    });
  }, [currentTime, config, showSafeGrid, recording, dims.width, dims.height, customImages, assetsReady]);

  useEffect(() => {
    if (!playing || recording) {
      lastTickRef.current = null;
      return;
    }
    let rafId = 0;
    const step = (now: number) => {
      if (lastTickRef.current !== null) {
        const dt = (now - lastTickRef.current) / 1000;
        setCurrentTime((prev) => {
          const next = prev + dt;
          return next >= totalDuration ? 0 : next;
        });
      }
      lastTickRef.current = now;
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [playing, recording, totalDuration]);

  const jumpToScene = useCallback(
    (index: number) => {
      setSelectedIdx(index);
      if (index < sceneOffsets.length) {
        setCurrentTime((sceneOffsets[index] ?? 0) + 0.05);
      } else {
        const outroStart = config.scenes.reduce((a, s) => a + s.durationSec, 0);
        setCurrentTime(outroStart + 0.05);
      }
    },
    [sceneOffsets, config.scenes],
  );

  const updateScene = useCallback((index: number, patch: Partial<ReelScene>) => {
    setConfig((prev) => ({
      ...prev,
      scenes: prev.scenes.map((sc, i) => (i === index ? { ...sc, ...patch } : sc)),
    }));
  }, []);

  const addScene = useCallback(() => {
    const newId = `sc-${Date.now()}`;
    const newScene: ReelScene = {
      id: newId,
      screen: 'home',
      durationSec: 8,
      theme: 'moon-walk',
      accentColor: '#C8F031',
      phonePosition: config.scenes.length % 2 === 0 ? 'right' : 'left',
      badgeText: 'YENİ ÖZELLİK',
      headlineTop: 'Fikirden çalışan',
      headlineAccent: 'sistemlere.',
      cardTitle: 'Özel Yazılım & Otomasyon',
      cardBody: 'Tüm iş süreçlerinizi tek ekrandan yönetebileceğiniz hızlı ve güvenli altyapı.',
      cardSubtag: 'SAYNOVRA',
    };
    setConfig((prev) => ({ ...prev, scenes: [...prev.scenes, newScene] }));
    setSelectedIdx(config.scenes.length);
  }, [config.scenes.length]);

  const deleteScene = useCallback(
    (index: number) => {
      if (config.scenes.length <= 1) return;
      setConfig((prev) => ({
        ...prev,
        scenes: prev.scenes.filter((_, i) => i !== index),
      }));
      setSelectedIdx((prev) => Math.max(0, prev - 1));
    },
    [config.scenes.length],
  );

  const handleImageUpload = useCallback(
    (index: number, file: File | undefined) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result);
        const sc = config.scenes[index];
        if (!sc) return;
        const img = new Image();
        img.onload = () => {
          setCustomImages((prev) => ({ ...prev, [sc.id]: img }));
          updateScene(index, { customImageUrl: dataUrl });
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    },
    [config.scenes, updateScene],
  );

  const resetDefaults = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setConfig(DEFAULT_REEL_CONFIG);
    setCustomImages({});
    setCurrentTime(0);
    setSelectedIdx(0);
  }, []);

  const downloadCoverPng = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `saynovra-gonderi-kapak-${dims.width}x${dims.height}.png`;
    a.click();
  }, [dims.width, dims.height]);

  const exportFullVideo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || recording) return;

    setPlaying(false);
    setRecording(true);
    setRecordProgress(0);

    const stream = canvas.captureStream(30);
    const mimeTypes = [
      'video/mp4;codecs=avc1',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ];
    const supportedMime = mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm';
    const ext = supportedMime.startsWith('video/mp4') ? 'mp4' : 'webm';

    const recorder = new MediaRecorder(stream, {
      mimeType: supportedMime,
      videoBitsPerSecond: 12_000_000,
    });

    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunks.push(ev.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: supportedMime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `saynovra-instagram-video-${dims.width}x${dims.height}.${ext}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setRecording(false);
      setPlaying(true);
    };

    recorder.start(200);
    const startWall = performance.now();

    const tick = (now: number) => {
      const elapsed = (now - startWall) / 1000;
      if (elapsed >= totalDuration) {
        setCurrentTime(totalDuration - 0.05);
        setRecordProgress(100);
        recorder.stop();
        return;
      }
      setCurrentTime(elapsed);
      setRecordProgress(Math.min(99, Math.round((elapsed / totalDuration) * 100)));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [recording, totalDuration, dims.width, dims.height]);

  const selectedScene = config.scenes[selectedIdx] ?? config.scenes[0];

  return (
    <div className="grid gap-6 xl:grid-cols-[460px_1fr]">
      {/* Left Column: Live Instagram Canvas Preview */}
      <div className="flex flex-col items-center gap-4">
        <Card className="w-full p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <Label className="text-lime">{dims.label}</Label>
              <div className="font-display text-base font-bold text-text">
                @saynovra Ay & Astronot Video Stüdyosu
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowSafeGrid((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                showSafeGrid
                  ? 'border-lime bg-lime/15 text-lime'
                  : 'border-line bg-surface-2 text-muted hover:text-text'
              }`}
            >
              <Grid className="size-3.5" /> 1:1 Kılavuz
            </button>
          </div>

          <div
            className="relative mx-auto w-full max-w-[400px] overflow-hidden rounded-2xl border border-line bg-ink shadow-2xl"
            style={{ aspectRatio: `${dims.width} / ${dims.height}` }}
          >
            <canvas
              ref={canvasRef}
              width={dims.width}
              height={dims.height}
              className="h-full w-full object-contain"
            />
            {recording && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-ink/80 backdrop-blur-xs">
                <div className="mb-2 font-display text-2xl font-bold text-lime">%{recordProgress}</div>
                <div className="text-sm font-medium text-text">
                  {dims.width}×{dims.height} Video Kaydediliyor...
                </div>
                <div className="mt-1 font-mono text-xs text-muted">Lütfen sekmeyi kapatmayın</div>
              </div>
            )}
          </div>

          {/* Playback Controls & Timeline Scrubber */}
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={recording}
                onClick={() => setPlaying((p) => !p)}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-lime text-ink transition hover:brightness-110 disabled:opacity-50"
              >
                {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
              </button>
              <input
                type="range"
                min={0}
                max={totalDuration}
                step={0.05}
                disabled={recording}
                value={currentTime}
                onChange={(e) => {
                  setPlaying(false);
                  setCurrentTime(Number(e.target.value));
                }}
                className="h-2 flex-1 cursor-pointer accent-lime"
              />
              <span className="w-24 text-right font-mono text-xs text-muted">
                {formatTime(currentTime)} / {formatTime(totalDuration)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={recording}
                onClick={exportFullVideo}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-lime px-3 py-2.5 text-xs font-bold text-ink transition hover:brightness-110 disabled:opacity-50"
              >
                <Video className="size-4" />
                {recording ? `Kaydediliyor (%${recordProgress})` : 'Videoyu İndir'}
              </button>
              <button
                type="button"
                disabled={recording}
                onClick={downloadCoverPng}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-xs font-semibold text-text transition hover:border-lime/50 disabled:opacity-50"
              >
                <Camera className="size-4" /> Bu Kareyi İndir (PNG)
              </button>
            </div>
          </div>
        </Card>
      </div>

      {/* Right Column: Comprehensive Scene & Brand Editor */}
      <div className="space-y-6">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Label className="text-lime">SAYNOVRA INSTAGRAM VİDEO STÜDYOSU</Label>
              <h1 className="font-display text-2xl font-bold text-text">
                Ay Yüzeyi & Astronot Tema Düzenleyici ({totalDuration} sn)
              </h1>
              <p className="mt-1 text-sm text-muted">
                Üst çubuklar kaldırıldı, başlıklar ve kart yazıları büyütülüp ortalandı, arka plana her sahnede farklı iş yapan astronot eklendi.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={config.aspectRatio ?? '4:5'}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    aspectRatio: e.target.value as AspectRatioPreset,
                  }))
                }
                className="rounded-xl border border-lime/40 bg-surface-2 px-3 py-2 text-xs font-semibold text-lime outline-none"
              >
                <option value="4:5">4:5 Gönderi (1080×1350)</option>
                <option value="9:16">9:16 Reels (1080×1920)</option>
                <option value="1:1">1:1 Kare (1080×1080)</option>
              </select>
              <button
                type="button"
                onClick={resetDefaults}
                className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-xs font-semibold text-muted transition hover:border-bad/40 hover:text-bad"
              >
                <RotateCcw className="size-3.5" /> Sıfırla
              </button>
            </div>
          </div>

          {/* Scene Selector Pills */}
          <div className="mt-5 flex flex-wrap gap-2">
            {config.scenes.map((sc, idx) => {
              const isSelected = selectedIdx === idx;
              const isPlayingHere = activeSceneIndex === idx;
              return (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => jumpToScene(idx)}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                    isSelected
                      ? 'border-lime bg-lime text-ink'
                      : isPlayingHere
                        ? 'border-lime/50 bg-lime/10 text-lime'
                        : 'border-line bg-surface-2 text-muted hover:text-text'
                  }`}
                >
                  <span className="font-mono">{idx + 1}.</span>
                  <span>{sc.cardTitle}</span>
                  <span className="font-mono text-[10px] opacity-75">({sc.durationSec}sn)</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={addScene}
              className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-lime/50 px-3.5 py-2 text-xs font-semibold text-lime transition hover:bg-lime/10"
            >
              <Plus className="size-3.5" /> Yeni Sahne Ekle
            </button>
            <button
              type="button"
              onClick={() => jumpToScene(config.scenes.length)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                activeSceneIndex === config.scenes.length
                  ? 'border-lime bg-lime text-ink'
                  : 'border-line bg-surface-2 text-muted hover:text-text'
              }`}
            >
              <Sparkles className="size-3.5" /> Kapanış ({config.outroDurationSec}sn)
            </button>
          </div>
        </Card>

        {/* Active Scene Editor */}
        {selectedScene && (
          <Card className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
              <div>
                <Label className="text-lime">SAHNE {selectedIdx + 1} ÖZELLEŞTİRME</Label>
                <h2 className="font-display text-lg font-bold text-text">{selectedScene.cardTitle}</h2>
              </div>
              <div className="flex items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-3 py-1.5 text-xs font-semibold text-text transition hover:border-lime">
                  <ImagePlus className="size-3.5 text-lime" />
                  <span>Telefona Özel Görsel Yükle</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageUpload(selectedIdx, e.target.files?.[0])}
                  />
                </label>
                {selectedScene.customImageUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomImages((prev) => {
                        const copy = { ...prev };
                        delete copy[selectedScene.id];
                        return copy;
                      });
                      updateScene(selectedIdx, { customImageUrl: undefined });
                    }}
                    className="rounded-xl border border-bad/40 px-2.5 py-1.5 text-xs text-bad"
                  >
                    Görseli Kaldır
                  </button>
                )}
                {config.scenes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => deleteScene(selectedIdx)}
                    className="inline-flex items-center gap-1 rounded-xl border border-bad/30 px-2.5 py-1.5 text-xs text-bad transition hover:bg-bad/10"
                  >
                    <Trash2 className="size-3.5" /> Sil
                  </button>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block space-y-1.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
                  Astronot Hareketi (Arka Plan)
                </span>
                <select
                  value={selectedScene.theme}
                  onChange={(e) =>
                    updateScene(selectedIdx, { theme: e.target.value as AtmosphereTheme })
                  }
                  className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm text-text outline-none focus:border-lime"
                >
                  {(Object.keys(THEME_LABELS) as AtmosphereTheme[]).map((k) => (
                    <option key={k} value={k}>
                      {THEME_LABELS[k]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
                  Telefon İçi Ekran Şablonu
                </span>
                <select
                  value={selectedScene.screen}
                  onChange={(e) =>
                    updateScene(selectedIdx, { screen: e.target.value as ScreenKind })
                  }
                  className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm text-text outline-none focus:border-lime"
                >
                  {(Object.keys(SCREEN_LABELS) as ScreenKind[]).map((k) => (
                    <option key={k} value={k}>
                      {SCREEN_LABELS[k]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
                  Telefon & Astronot Yönü
                </span>
                <select
                  value={selectedScene.phonePosition}
                  onChange={(e) =>
                    updateScene(selectedIdx, { phonePosition: e.target.value as PhonePosition })
                  }
                  className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm text-text outline-none focus:border-lime"
                >
                  <option value="right">Telefon Sağda · Astronot Solda</option>
                  <option value="left">Telefon Solda · Astronot Sağda</option>
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
                  Vurgu Rengi & Süre (sn)
                </span>
                <div className="flex gap-2">
                  <select
                    value={selectedScene.accentColor ?? '#C8F031'}
                    onChange={(e) => updateScene(selectedIdx, { accentColor: e.target.value })}
                    className="flex-1 rounded-xl border border-line bg-surface-2 px-2 py-2.5 text-sm text-text outline-none focus:border-lime"
                  >
                    {ACCENT_COLORS.map((c) => (
                      <option key={c.hex} value={c.hex}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={3}
                    max={25}
                    value={selectedScene.durationSec}
                    onChange={(e) =>
                      updateScene(selectedIdx, {
                        durationSec: Math.max(3, Math.min(25, Number(e.target.value) || 8)),
                      })
                    }
                    className="w-20 rounded-xl border border-line bg-surface-2 px-2.5 py-2.5 text-sm text-text outline-none focus:border-lime"
                  />
                </div>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block space-y-1.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
                  Üst Rozet (Badge)
                </span>
                <input
                  type="text"
                  value={selectedScene.badgeText}
                  onChange={(e) => updateScene(selectedIdx, { badgeText: e.target.value })}
                  className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-text outline-none focus:border-lime"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
                  Ortalanmış Üst Başlık (Beyaz)
                </span>
                <input
                  type="text"
                  value={selectedScene.headlineTop}
                  onChange={(e) => updateScene(selectedIdx, { headlineTop: e.target.value })}
                  className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-text outline-none focus:border-lime"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-lime">
                  Ortalanmış Vurgu Başlığı (Renkli)
                </span>
                <input
                  type="text"
                  value={selectedScene.headlineAccent}
                  onChange={(e) => updateScene(selectedIdx, { headlineAccent: e.target.value })}
                  className="w-full rounded-xl border border-lime/40 bg-surface-2 px-3 py-2 text-sm font-semibold text-lime outline-none focus:border-lime"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
                  🔴 🟡 🟢 Bilgi Kartı Başlığı (Ortalanmış)
                </span>
                <input
                  type="text"
                  value={selectedScene.cardTitle}
                  onChange={(e) => updateScene(selectedIdx, { cardTitle: e.target.value })}
                  className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm font-semibold text-text outline-none focus:border-lime"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
                  Kart Sağ Üst Etiket
                </span>
                <input
                  type="text"
                  value={selectedScene.cardSubtag}
                  onChange={(e) => updateScene(selectedIdx, { cardSubtag: e.target.value })}
                  className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 font-mono text-sm text-lime outline-none focus:border-lime"
                />
              </label>
            </div>

            <label className="block space-y-1.5">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
                🔴 🟡 🟢 Bilgi Kartı Açıklama Metni (Ortalanmış & Büyük)
              </span>
              <textarea
                rows={2}
                value={selectedScene.cardBody}
                onChange={(e) => updateScene(selectedIdx, { cardBody: e.target.value })}
                className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-text outline-none focus:border-lime"
              />
            </label>
          </Card>
        )}

        {/* Global Brand & Outro Settings */}
        <Card className="space-y-4">
          <div className="border-b border-line pb-3">
            <Label className="text-lime">GENEL MARKA & HAZIR VİDEO DOSYASI</Label>
            <h2 className="font-display text-lg font-bold text-text">
              @saynovra Alt Bar ve Kapanış Ekranı
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block space-y-1.5">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
                Marka Adı
              </span>
              <input
                type="text"
                value={config.brandName}
                onChange={(e) => setConfig((prev) => ({ ...prev, brandName: e.target.value }))}
                className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-text outline-none focus:border-lime"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
                Proje / Ürün Başlığı
              </span>
              <input
                type="text"
                value={config.productTitle}
                onChange={(e) => setConfig((prev) => ({ ...prev, productTitle: e.target.value }))}
                className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-text outline-none focus:border-lime"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
                Web Adresi
              </span>
              <input
                type="text"
                value={config.brandWebsite}
                onChange={(e) => setConfig((prev) => ({ ...prev, brandWebsite: e.target.value }))}
                className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-lime outline-none focus:border-lime"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
                Kapanış Sloganı
              </span>
              <input
                type="text"
                value={config.brandTagline}
                onChange={(e) => setConfig((prev) => ({ ...prev, brandTagline: e.target.value }))}
                className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-text outline-none focus:border-lime"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
                Hazır Render Edilmiş MP4 (1080×1350 Gönderi Boyutu)
              </span>
              <a
                href="/novra-gym-instagram-reel.mp4"
                download="saynovra-novra-gym-instagram-gonderi.mp4"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-lime/40 bg-lime/10 px-3 py-2 text-sm font-bold text-lime transition hover:bg-lime/20"
              >
                <Download className="size-4" /> Hazır MP4 İndir (novra-gym-instagram-reel.mp4)
              </a>
            </label>
          </div>
        </Card>
      </div>
    </div>
  );
}
