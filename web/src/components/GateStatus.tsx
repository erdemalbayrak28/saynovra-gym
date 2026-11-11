import { CircleAlert, Lock, ScanLine, ShieldX, Unlock } from 'lucide-react';
import type { CheckinDto } from '../../../shared/contract';
import { daysLeftText, firstName } from '../lib/format';
import { Label } from './ui';

export type GateView =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'granted'; checkin: CheckinDto }
  | { kind: 'denied'; checkin: CheckinDto; reasonText: string }
  | { kind: 'error'; message: string };

const FRAME: Record<GateView['kind'], string> = {
  idle: 'border-line bg-ink',
  checking: 'border-info bg-info/10',
  granted: 'border-ok bg-ok/15 shadow-[0_0_60px_rgb(46_229_157/0.25)]',
  denied: 'border-bad bg-bad/15 shadow-[0_0_60px_rgb(255_90_79/0.25)]',
  error: 'border-bad bg-bad/10',
};

const ICON_BOX: Record<GateView['kind'], string> = {
  idle: 'border border-line bg-surface text-muted',
  checking: 'animate-pulse bg-info text-ink',
  granted: 'bg-ok text-ink',
  denied: 'bg-bad text-white',
  error: 'bg-bad text-white',
};

function content(view: GateView): { badge: string; title: string; detail: string } {
  switch (view.kind) {
    case 'idle':
      return {
        badge: 'Kapı hazır',
        title: 'QR kodunuzu kameraya gösterin',
        detail: 'Kod 30 saniyede bir yenilenir. Ekran görüntüsü kabul edilmez.',
      };
    case 'checking':
      return { badge: 'Doğrulanıyor', title: 'Kod kontrol ediliyor', detail: 'İmza, süre ve üyelik durumu' };
    case 'granted': {
      const member = view.checkin.member;
      const name = member ? firstName(member.fullName) : '';
      const entering = view.checkin.direction === 'in';
      return {
        badge: entering ? 'Giriş onaylandı' : 'Çıkış onaylandı',
        title: entering ? `Hoş geldin, ${name}` : `Görüşmek üzere, ${name}`,
        detail: member?.role === 'trainer' ? 'Eğitmen' : member?.planName ? `${member.planName} üyelik · ${daysLeftText(member.daysLeft)}` : '',
      };
    }
    case 'denied':
      return { badge: 'Reddedildi', title: view.reasonText, detail: view.checkin.member?.fullName ?? 'Tanınmayan kod' };
    case 'error':
      return { badge: 'Bağlantı hatası', title: 'Kod doğrulanamadı', detail: view.message };
  }
}

export function GateStatus({ view }: { view: GateView }) {
  const { badge, title, detail } = content(view);
  const Icon = { idle: Lock, checking: ScanLine, granted: Unlock, denied: ShieldX, error: CircleAlert }[view.kind];

  return (
    <div className={`rounded-3xl border-2 p-6 transition-all duration-300 ${FRAME[view.kind]}`} role="status" aria-live="assertive">
      <div className="flex items-center gap-5">
        <div className={`grid size-16 shrink-0 place-items-center rounded-2xl transition-colors ${ICON_BOX[view.kind]}`}>
          <Icon className="size-8" strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <Label className="text-muted">{badge}</Label>
          <h2 className="mt-1 font-display text-2xl font-bold leading-tight text-text sm:text-3xl">{title}</h2>
          {detail && <p className="mt-1 text-sm text-muted">{detail}</p>}
        </div>
      </div>
    </div>
  );
}
