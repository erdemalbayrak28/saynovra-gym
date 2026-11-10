import { LogOut } from 'lucide-react';
import type { ReactNode } from 'react';
import { useLiveState } from '../lib/live';
import { ROUTES, routeHref, type Route } from '../lib/route';
import type { StaffSession } from '../lib/session';
import { Wordmark } from './ui';

const ROLE_TEXT = { owner: 'Salon sahibi', desk: 'Gişe' } as const;

interface Props {
  route: Route;
  session: StaffSession;
  onLogout: () => void;
  /** Side-by-side screens use the full width of a large monitor. */
  wide?: boolean;
  children: ReactNode;
}

export function AppShell({ route, session, onLogout, wide = false, children }: Props) {
  const liveState = useLiveState();
  const caption = ROUTES.find((entry) => entry.route === route)?.caption;
  const width = wide ? 'max-w-[1680px]' : 'max-w-7xl';

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/90 px-4 py-3 backdrop-blur lg:px-8">
        <div className={`mx-auto flex flex-wrap items-center justify-between gap-x-6 gap-y-3 ${width}`}>
          <Wordmark caption={caption} />
          <nav className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto px-1 lg:order-none lg:w-auto" aria-label="Ekranlar">
            {ROUTES.map((entry) => {
              const current = entry.route === route;
              return (
                <a
                  key={entry.route}
                  href={routeHref(entry.route)}
                  aria-current={current ? 'page' : undefined}
                  className={`shrink-0 rounded-xl px-3 py-1.5 text-sm font-semibold transition ${
                    current ? 'bg-lime text-ink' : 'text-muted hover:bg-surface-2 hover:text-text'
                  }`}
                >
                  {entry.label}
                </a>
              );
            })}
          </nav>
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
                liveState === 'open' ? 'border-ok/30 bg-ok/10 text-ok' : 'border-bad/30 bg-bad/10 text-bad'
              }`}
            >
              <span className={`size-1.5 rounded-full ${liveState === 'open' ? 'animate-pulse bg-ok' : 'bg-bad'}`} />
              {liveState === 'open' ? 'Canlı' : liveState === 'connecting' ? 'Bağlanıyor' : 'Bağlantı yok'}
            </span>
            <span className="hidden text-right leading-tight sm:block">
              <span className="block text-sm text-text">{session.staff.name}</span>
              <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{ROLE_TEXT[session.staff.role]}</span>
            </span>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-sm text-muted transition hover:text-text"
            >
              <LogOut className="size-4" /> Çıkış
            </button>
          </div>
        </div>
      </header>
      <main className={`mx-auto px-4 py-6 lg:px-8 ${width}`}>{children}</main>
    </div>
  );
}
