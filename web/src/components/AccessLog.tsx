import { LogIn, LogOut } from 'lucide-react';
import { useRef } from 'react';
import { GATE_REASON_TEXT, type CheckinDto } from '../../../shared/contract';
import { clockTime } from '../lib/format';
import { Initials, Label } from './ui';

/** Live gate log. Rows that arrive after the first render flash once. */
export function AccessLog({ checkins }: { checkins: CheckinDto[] }) {
  const initialIds = useRef<Set<number> | null>(null);
  if (initialIds.current === null && checkins.length > 0) initialIds.current = new Set(checkins.map((c) => c.id));

  if (checkins.length === 0) {
    return <p className="rounded-2xl border border-line bg-ink p-6 text-center text-sm text-muted">Henüz geçiş yok.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-ink">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-line bg-surface">
            {['Üye', 'Yön', 'Saat', 'Durum'].map((heading, i) => (
              <th key={heading} className={`px-4 py-3 ${i === 3 ? 'text-right' : ''}`}>
                <Label className="text-muted">{heading}</Label>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {checkins.map((checkin) => {
            const fresh = initialIds.current !== null && !initialIds.current.has(checkin.id);
            const granted = checkin.result === 'granted';
            return (
              <tr key={checkin.id} className={fresh ? 'animate-row-in' : ''}>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Initials text={checkin.member?.initials ?? '?'} />
                    <span className="font-medium text-text">{checkin.member?.fullName ?? 'Tanınmayan kod'}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  {checkin.direction ? (
                    <span className={`inline-flex items-center gap-1.5 font-semibold ${checkin.direction === 'in' ? 'text-ok' : 'text-info'}`}>
                      {checkin.direction === 'in' ? <LogIn className="size-4" /> : <LogOut className="size-4" />}
                      {checkin.direction === 'in' ? 'Giriş' : 'Çıkış'}
                    </span>
                  ) : (
                    <span className="text-muted">-</span>
                  )}
                </td>
                <td className="px-4 py-2.5 font-mono text-muted">{clockTime(checkin.at)}</td>
                <td className="px-4 py-2.5 text-right">
                  <span
                    className={`inline-block rounded-full border px-2.5 py-1 text-xs font-semibold ${
                      granted ? 'border-ok/30 bg-ok/15 text-ok' : 'border-bad/30 bg-bad/15 text-bad'
                    }`}
                  >
                    {granted ? 'Onaylandı' : (checkin.reason ? GATE_REASON_TEXT[checkin.reason] : 'Reddedildi')}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
