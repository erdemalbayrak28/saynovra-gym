import { ChevronDown, Users } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { GATE_CODE_PREFIX, gateStep, type CheckinDto, type FloorEvent, type LiveEvent, type StaffSummary } from '../../../shared/contract';
import { ApiError, api } from '../lib/api';
import { beep } from '../lib/beep';
import { useLiveEvent } from '../lib/live';
import { AccessLog } from './AccessLog';
import { FloorFeed } from './FloorFeed';
import { GateStatus, type GateView } from './GateStatus';
import { QrScanner } from './QrScanner';
import { Card, Label } from './ui';

/** How long a result stays on screen before the gate is ready again. */
const RESULT_HOLD_MS = 3400;
/** A phone held at the camera is decoded many times per second; the same text is sent once. */
const SAME_CODE_COOLDOWN_MS = 5000;
const LOG_LIMIT = 30;
const COMPACT_LOG_LIMIT = 6;
const FLOOR_LIMIT = 5;

interface Props {
  token: string;
  onUnauthorized: () => void;
  /** One column for the side-by-side screen: scanner, result, numbers and the latest passes. */
  compact?: boolean;
}

export function GatePanel({ token, onUnauthorized, compact = false }: Props) {
  const [view, setView] = useState<GateView>({ kind: 'idle' });
  const [checkins, setCheckins] = useState<CheckinDto[]>([]);
  const [summary, setSummary] = useState<StaffSummary | null>(null);
  const [floor, setFloor] = useState<FloorEvent[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const lastCode = useRef<{ text: string; at: number } | null>(null);
  const resetTimer = useRef<number | undefined>(undefined);
  const busy = view.kind !== 'idle';

  const fail = useCallback(
    (err: unknown): string => {
      if (err instanceof ApiError && err.status === 401) onUnauthorized();
      return err instanceof ApiError ? err.message : 'Beklenmeyen hata';
    },
    [onUnauthorized],
  );

  const refreshSummary = useCallback(() => {
    api.summary(token).then(setSummary, (err: unknown) => setLoadError(fail(err)));
  }, [token, fail]);

  useEffect(() => {
    api.checkins(token, LOG_LIMIT).then(setCheckins, (err: unknown) => setLoadError(fail(err)));
    api.floor(token).then((events) => setFloor(events.slice(0, FLOOR_LIMIT)), (err: unknown) => setLoadError(fail(err)));
    refreshSummary();
    return () => window.clearTimeout(resetTimer.current);
  }, [token, refreshSummary, fail]);

  useLiveEvent((event: LiveEvent) => {
    if (event.type === 'floor') {
      setFloor((current) => [event.event, ...current.filter((e) => e.id !== event.event.id)].slice(0, FLOOR_LIMIT));
      return;
    }
    if (event.type !== 'checkin') return;
    setCheckins((current) => [event.checkin, ...current.filter((c) => c.id !== event.checkin.id)].slice(0, LOG_LIMIT));
    setSummary((current) => (current ? { ...current, gym: event.gym } : current));
    refreshSummary();
  });

  const submitCode = useCallback(
    async (text: string) => {
      const now = Date.now();
      if (busy) return;
      if (lastCode.current && lastCode.current.text === text && now - lastCode.current.at < SAME_CODE_COOLDOWN_MS) return;
      lastCode.current = { text, at: now };

      setView({ kind: 'checking' });
      try {
        const result = await api.scan(token, text);
        if (result.checkin.result === 'granted') {
          setView({ kind: 'granted', checkin: result.checkin });
          beep('ok');
        } else {
          setView({ kind: 'denied', checkin: result.checkin, reasonText: result.reasonText ?? 'Reddedildi' });
          beep('bad');
        }
      } catch (err) {
        setView({ kind: 'error', message: fail(err) });
        beep('bad');
      }
      window.clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(() => setView({ kind: 'idle' }), RESULT_HOLD_MS);
    },
    [busy, token, fail],
  );

  const gym = summary?.gym;
  const occupancy = gym ? Math.round((gym.insideCount / gym.capacity) * 100) : null;
  const stats = (
    <div className="grid grid-cols-3 gap-3">
      <Stat label="İçeride" value={gym ? `${gym.insideCount}` : '-'} hint={gym ? `/ ${gym.capacity} · %${occupancy}` : ''} icon />
      <Stat label="Bugün giriş" value={summary ? `${summary.todayGranted}` : '-'} />
      <Stat label="Bugün ret" value={summary ? `${summary.todayDenied}` : '-'} tone="bad" />
    </div>
  );
  const log = (limit: number) =>
    loadError ? (
      <p className="rounded-2xl border border-bad/30 bg-bad/10 p-4 text-sm text-bad">{loadError}</p>
    ) : (
      <AccessLog checkins={checkins.slice(0, limit)} />
    );
  const scanner = (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <Label className="text-lime">QR okuyucu</Label>
        <Label className="text-muted">Telefonu kameraya tutun</Label>
      </div>
      <QrScanner onCode={submitCode} paused={busy} short={compact} />
    </Card>
  );

  if (compact) {
    return (
      <div className="space-y-4">
        <GateStatus view={view} />
        {scanner}
        {stats}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <Label className="text-text">Geçiş kayıtları</Label>
            <Label className="text-muted">Son {COMPACT_LOG_LIMIT}</Label>
          </div>
          {log(COMPACT_LOG_LIMIT)}
        </div>
        <TestTools disabled={busy} onSubmit={submitCode} />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="space-y-4 lg:col-span-5">
        {scanner}
        <TestTools disabled={busy} onSubmit={submitCode} />
      </div>

      <div className="space-y-6 lg:col-span-7">
        <GateStatus view={view} />
        {stats}
        <FloorFeed events={floor} />
        <div>
          <div className="mb-3 flex items-center justify-between">
            <Label className="text-text">Geçiş kayıtları</Label>
            <Label className="text-muted">Son {LOG_LIMIT}</Label>
          </div>
          {log(LOG_LIMIT)}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, hint, icon, tone }: { label: string; value: string; hint?: string; icon?: boolean; tone?: 'bad' }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <Label className="flex items-center gap-1.5 text-muted">
        {icon && <Users className="size-3.5" />}
        {label}
      </Label>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
        <span className={`font-display text-3xl font-bold ${tone === 'bad' ? 'text-bad' : 'text-lime'}`}>{value}</span>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
    </div>
  );
}

/** For rehearsals without a phone: paste a code, or send a correctly shaped code with a forged signature. */
function TestTools({ disabled, onSubmit }: { disabled: boolean; onSubmit: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (code.trim()) onSubmit(code.trim());
  };
  const forged = () => onSubmit(`${GATE_CODE_PREFIX}.1.${gateStep(Date.now())}.i.0.${'0'.repeat(16)}`);

  return (
    <Card className="p-0">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-5 py-4" aria-expanded={open}>
        <Label className="text-muted">Test araçları</Label>
        <ChevronDown className={`size-4 text-muted transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-line px-5 py-4">
          <form onSubmit={submit} className="flex gap-2">
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="NG2.1.59805931.i.0.d16e..."
              className="min-w-0 flex-1 rounded-xl border border-line bg-ink px-3 py-2 font-mono text-sm text-text outline-none focus:border-lime"
              aria-label="QR kodu"
            />
            <button type="submit" disabled={disabled} className="rounded-xl bg-lime px-4 py-2 text-sm font-bold text-ink disabled:opacity-50">
              Okut
            </button>
          </form>
          <button
            type="button"
            disabled={disabled}
            onClick={forged}
            className="w-full rounded-xl border border-bad/30 bg-bad/10 px-4 py-2 text-sm font-semibold text-bad disabled:opacity-50"
          >
            Sahte imzalı kod dene
          </button>
        </div>
      )}
    </Card>
  );
}
