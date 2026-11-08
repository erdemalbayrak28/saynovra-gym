import { Delete } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, api } from '../lib/api';
import type { StaffSession } from '../lib/session';
import { Card, Label, Wordmark } from '../components/ui';

const PIN_LENGTH = 4;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const;

export function StaffLogin({ onLogin }: { onLogin: (session: StaffSession) => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = useCallback(
    async (value: string) => {
      setBusy(true);
      setError(null);
      try {
        onLogin(await api.staffLogin(value));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Giriş yapılamadı');
        setPin('');
      } finally {
        setBusy(false);
      }
    },
    [onLogin],
  );

  const press = useCallback(
    (key: string) => {
      if (busy) return;
      if (key === 'del') {
        setPin(pin.slice(0, -1));
        return;
      }
      if (pin.length >= PIN_LENGTH) return;
      const next = pin + key;
      setPin(next);
      if (next.length === PIN_LENGTH) void submit(next);
    },
    [busy, pin, submit],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (/^\d$/.test(event.key)) press(event.key);
      else if (event.key === 'Backspace') press('del');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press]);

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <Card className="w-full max-w-sm p-8">
        <Wordmark caption="Personel girişi" />
        <p className="mt-6 text-sm text-muted">Kapı ekranı ve resepsiyon için 4 haneli PIN.</p>

        <div className="mt-6 flex justify-center gap-3" aria-label={`${pin.length} hane girildi`}>
          {Array.from({ length: PIN_LENGTH }, (_, i) => (
            <span key={i} className={`size-4 rounded-full border ${i < pin.length ? 'border-lime bg-lime' : 'border-line bg-surface-2'}`} />
          ))}
        </div>
        <p className="mt-3 h-5 text-center text-sm text-bad" role="alert">
          {error}
        </p>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {KEYS.map((key, i) =>
            key === '' ? (
              <span key={`gap-${i}`} />
            ) : (
              <button
                key={key}
                type="button"
                disabled={busy}
                onClick={() => press(key)}
                className="grid h-14 place-items-center rounded-2xl border border-line bg-surface-2 font-display text-xl font-bold text-text transition hover:border-lime/50 active:scale-95 disabled:opacity-50"
                aria-label={key === 'del' ? 'Sil' : key}
              >
                {key === 'del' ? <Delete className="size-5" /> : key}
              </button>
            ),
          )}
        </div>
        <Label className="mt-6 block text-center text-muted">Yerel demo · SAYNOVRA</Label>
      </Card>
    </main>
  );
}
