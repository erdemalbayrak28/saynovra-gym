import { KeyRound, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ActivationCodeResponse } from '../../../../shared/contract';
import { phone } from '../../lib/format';
import { Label } from '../ui';

const TICK_MS = 1000;

function remaining(expiresAt: string): number {
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 1000));
}

function mmss(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

interface Props {
  activation: ActivationCodeResponse;
  memberPhone: string;
  /** Password reset for an account that is already active, rather than a first sign-in. */
  reset?: boolean;
  busy?: boolean;
  onRenew: () => void;
}

/**
 * The one-time code, large enough to read across the desk. It exists only in this component's
 * state: the server keeps a hash and never sends it again.
 */
export function ActivationCode({ activation, memberPhone, reset = false, busy = false, onRenew }: Props) {
  const [left, setLeft] = useState(() => remaining(activation.expiresAt));

  useEffect(() => {
    setLeft(remaining(activation.expiresAt));
    const timer = window.setInterval(() => setLeft(remaining(activation.expiresAt)), TICK_MS);
    return () => window.clearInterval(timer);
  }, [activation.expiresAt]);

  const expired = left === 0;
  return (
    <div className={`rounded-2xl border p-4 ${expired ? 'border-line bg-ink' : 'border-lime/40 bg-lime/5'}`}>
      <div className="flex items-center justify-between gap-3">
        <Label className={expired ? 'text-muted' : 'text-lime'}>{reset ? 'Şifre yenileme kodu' : 'Etkinleştirme kodu'}</Label>
        <Label className={expired ? 'text-bad' : 'text-muted'}>{expired ? 'Süresi doldu' : `${mmss(left)} geçerli`}</Label>
      </div>

      <p
        className={`mt-3 text-center font-mono text-5xl font-bold tracking-[0.3em] sm:text-6xl ${expired ? 'text-muted line-through' : 'text-text'}`}
        aria-label={`Kod ${activation.code.split('').join(' ')}`}
      >
        {activation.code}
      </p>

      <ol className="mt-4 space-y-1 text-sm text-muted">
        <li className="flex gap-2">
          <KeyRound className="mt-0.5 size-4 shrink-0 text-lime" />
          <span>
            Üye uygulamada <span className="text-text">"İlk kez mi giriyorsun? Kodla etkinleştir"</span>e basar, <span className="font-mono text-text">{phone(memberPhone)}</span> numarasını ve bu kodu girip kendi şifresini belirler.
          </span>
        </li>
        <li className="pl-6 text-xs">
          Kod bir kez kullanılır; 5 yanlış denemede geçersizleşir. {reset ? 'Yeni şifre belirlenince üyenin eski oturumları kapanır.' : ''}
        </li>
      </ol>

      <button
        type="button"
        onClick={onRenew}
        disabled={busy}
        className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm font-semibold text-text transition hover:border-muted disabled:opacity-40"
      >
        <RefreshCw className="size-4" /> Yeni kod ver
      </button>
      <p className="mt-2 text-xs text-muted">Yeni kod verilince bu kod geçersiz olur. Bu ekrandan çıkınca kod bir daha gösterilmez.</p>
    </div>
  );
}
