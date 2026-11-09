import { Handshake, Radio } from 'lucide-react';
import type { FloorEvent } from '../../../shared/contract';
import { clockTime } from '../lib/format';
import { Label } from './ui';

/** Gym floor feed: spotter posts and matches from the buddy radar, newest first. */
export function FloorFeed({ events }: { events: FloorEvent[] }) {
  return (
    <div className="rounded-2xl border border-info/30 bg-ink p-4">
      <div className="mb-3 flex items-center justify-between">
        <Label className="flex items-center gap-2 text-text">
          <Radio className="size-4 animate-pulse text-info" />
          Salon içi akış
        </Label>
        <Label className="text-muted">Buddy radarı</Label>
      </div>
      {events.length === 0 ? (
        <p className="text-sm text-muted">Henüz spotter ilanı ya da eşleşme yok.</p>
      ) : (
        <ul className="space-y-2">
          {events.map((event) => (
            <li
              key={event.id}
              className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm ${
                event.kind === 'matched' ? 'border-ok/40 bg-ok/10 font-semibold text-text' : 'border-line bg-surface text-text/90'
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                {event.kind === 'matched' ? <Handshake className="size-4 shrink-0 text-ok" /> : <Radio className="size-4 shrink-0 text-info" />}
                <span className="truncate">{event.text}</span>
              </span>
              <span className="shrink-0 font-mono text-xs text-lime">{clockTime(event.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
