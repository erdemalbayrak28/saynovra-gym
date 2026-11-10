import { Ban, CircleX, Receipt, Snowflake, Sun } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import {
  PAYMENT_METHOD_TEXT,
  type MemberDetail,
  type MembershipDetail,
  type MembershipEventDto,
  type PaymentMethod,
  type PlanDto,
  type StaffRole,
} from '../../../../shared/contract';
import { calendarDate, dateTime, daysBetween, daysLeftText, gymToday, money, phone } from '../../lib/format';
import { Card, Label } from '../ui';
import { StatusPill } from './parts';
import { SalePanel } from './SalePanel';

export type MembershipAction = 'freeze' | 'unfreeze' | 'cancel';

interface Props {
  detail: MemberDetail;
  plans: PlanDto[];
  role: StaffRole;
  busy: boolean;
  error: string | null;
  onSell: (planId: number, method: PaymentMethod) => Promise<boolean>;
  onAction: (membershipId: number, action: MembershipAction) => Promise<boolean>;
}

export function MemberCard({ detail, plans, role, busy, error, onSell, onAction }: Props) {
  const { member, current } = detail;
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-lime font-display text-xl font-bold text-ink">{member.initials}</span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-2xl font-bold text-text">{member.fullName}</h2>
            <p className="font-mono text-sm text-muted">{phone(member.phone)}</p>
          </div>
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
              member.isInside ? 'border-ok/30 bg-ok/10 text-ok' : 'border-line text-muted'
            }`}
          >
            <span className={`size-1.5 rounded-full ${member.isInside ? 'bg-ok' : 'bg-muted'}`} />
            {member.isInside ? 'Salonda' : 'Dışarıda'}
          </span>
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4">
          <Fact label="Son 30 gün" value={`${detail.visitsLast30Days} giriş`} />
          <Fact label="Son giriş" value={detail.lastVisitAt ? dateTime(detail.lastVisitAt) : 'Hiç'} />
          <Fact label="Kayıt" value={calendarDate(detail.joinedAt.slice(0, 10))} />
        </dl>
      </Card>

      <MembershipPanel key={current?.id ?? 'none'} detail={detail} plans={plans} role={role} busy={busy} error={error} onSell={onSell} onAction={onAction} />

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <Label className="text-text">İşlem geçmişi</Label>
          <Label className="text-muted">Değiştirilemez kayıt</Label>
        </div>
        {detail.history.length === 0 ? (
          <p className="text-sm text-muted">Henüz kayıt yok.</p>
        ) : (
          <ol className="divide-y divide-line">
            {detail.history.map((event) => (
              <HistoryRow key={event.id} event={event} />
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt>
        <Label className="text-muted">{label}</Label>
      </dt>
      <dd className="mt-0.5 truncate text-sm font-semibold text-text">{value}</dd>
    </div>
  );
}

type Panel = 'none' | 'sale' | 'cancel';

function MembershipPanel({ detail, plans, role, busy, error, onSell, onAction }: Omit<Props, 'detail'> & { detail: MemberDetail }) {
  const [panel, setPanel] = useState<Panel>('none');
  const current = detail.current;
  const upcoming = detail.memberships.filter((m) => m.upcoming && m.status === 'active');
  const frozen = current?.status === 'frozen';
  const canFreeze = current?.status === 'active';
  const freezeLeft = current ? current.freezeDaysAllowed - current.freezeDaysUsed : 0;
  const cancellable = current?.status === 'active' || frozen;

  const sell = async (planId: number, method: PaymentMethod) => {
    if (await onSell(planId, method)) setPanel('none');
  };
  const act = async (action: MembershipAction) => {
    if (current && (await onAction(current.id, action))) setPanel('none');
  };

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <Label className="text-text">Üyelik</Label>
        {current && <StatusPill status={current.status} />}
      </div>

      {current ? <MembershipSummaryView membership={current} /> : <p className="text-sm text-muted">Başlamış bir üyeliği yok. Paket satarak başlatabilirsiniz.</p>}

      {upcoming.map((m) => (
        <p key={m.id} className="mt-3 rounded-xl border border-line bg-ink px-3 py-2 text-sm text-muted">
          Sıradaki: <span className="text-text">{m.planName}</span>, {calendarDate(m.startsOn)} tarihinde başlıyor
        </p>
      ))}

      <div className="mt-4 flex flex-wrap gap-2">
        <ActionButton tone="primary" disabled={busy || frozen} onClick={() => setPanel(panel === 'sale' ? 'none' : 'sale')}>
          <Receipt className="size-4" /> Paket sat
        </ActionButton>
        {canFreeze && (
          <ActionButton disabled={busy || freezeLeft <= 0} onClick={() => act('freeze')}>
            <Snowflake className="size-4" /> Dondur
          </ActionButton>
        )}
        {frozen && (
          <ActionButton disabled={busy} onClick={() => act('unfreeze')}>
            <Sun className="size-4" /> Dondurmayı kaldır
          </ActionButton>
        )}
        {cancellable && (
          <ActionButton tone="danger" disabled={busy || role !== 'owner'} onClick={() => setPanel(panel === 'cancel' ? 'none' : 'cancel')}>
            <Ban className="size-4" /> İptal et
          </ActionButton>
        )}
      </div>
      <Hints frozen={frozen} canFreeze={canFreeze} freezeLeft={freezeLeft} membership={current} cancellable={cancellable} role={role} />

      {panel === 'sale' && <div className="mt-4"><SalePanel plans={plans} memberships={detail.memberships} busy={busy} onSell={sell} onClose={() => setPanel('none')} /></div>}
      {panel === 'cancel' && (
        <div className="mt-4 rounded-2xl border border-bad/40 bg-bad/10 p-4">
          <p className="text-sm text-text">Bu üyelik iptal edilsin mi? İptal geri alınmaz; üye kapıdan giremez, içerideyse çıkabilir.</p>
          <div className="mt-3 flex gap-2">
            <ActionButton tone="danger" disabled={busy} onClick={() => act('cancel')}>
              <CircleX className="size-4" /> Evet, iptal et
            </ActionButton>
            <ActionButton disabled={busy} onClick={() => setPanel('none')}>
              Vazgeç
            </ActionButton>
          </div>
        </div>
      )}
      {error && <p className="mt-3 rounded-xl border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad" role="alert">{error}</p>}
    </Card>
  );
}

function MembershipSummaryView({ membership }: { membership: MembershipDetail }) {
  const total = Math.max(1, daysBetween(membership.startsOn, membership.endsOn) + 1);
  const elapsed = Math.min(total, Math.max(0, daysBetween(membership.startsOn, gymToday())));
  const showProgress = membership.status === 'active' || membership.status === 'frozen';
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-display text-xl font-bold text-text">{membership.planName}</span>
        <span className="text-sm text-muted">{money(membership.priceKurus)}</span>
      </div>
      <p className="mt-1 text-sm text-muted">
        {calendarDate(membership.startsOn)} → {calendarDate(membership.endsOn)}
        {membership.status === 'active' && <span className="text-text"> · {daysLeftText(membership.daysLeft)}</span>}
      </p>
      {showProgress && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink" aria-hidden>
          <div className={`h-full ${membership.status === 'frozen' ? 'bg-info' : 'bg-lime'}`} style={{ width: `${(elapsed / total) * 100}%` }} />
        </div>
      )}
      <p className="mt-3 text-sm text-muted">
        {membership.freezeDaysAllowed === 0
          ? 'Bu pakette dondurma hakkı yok.'
          : `Dondurma hakkı ${membership.freezeDaysAllowed} gün, kalan ${membership.freezeDaysAllowed - membership.freezeDaysUsed} gün.`}
        {membership.frozenFrom && <FrozenSince from={membership.frozenFrom} />}
      </p>
    </div>
  );
}

function FrozenSince({ from }: { from: string }) {
  const days = daysBetween(from, gymToday());
  return (
    <span className="text-info">
      {' '}
      {days === 0 ? 'Bugün donduruldu.' : `${calendarDate(from)} tarihinden beri dondurulmuş (${days} gün).`}
    </span>
  );
}

function Hints(props: { frozen: boolean; canFreeze: boolean; freezeLeft: number; membership: MembershipDetail | null; cancellable: boolean; role: StaffRole }) {
  const hints: string[] = [];
  if (props.frozen) hints.push('Dondurulmuş üyelikte yeni paket satılamaz; önce dondurmayı kaldırın.');
  if (props.canFreeze && props.freezeLeft <= 0 && props.membership) {
    hints.push(props.membership.freezeDaysAllowed === 0 ? `${props.membership.planName} pakette dondurma yok.` : 'Dondurma hakkı bitti.');
  }
  if (props.cancellable && props.role !== 'owner') hints.push('İptal yalnızca salon sahibi yetkisinde.');
  if (hints.length === 0) return null;
  return <p className="mt-2 text-xs text-muted">{hints.join(' ')}</p>;
}

function ActionButton({ children, onClick, disabled, tone = 'ghost' }: { children: ReactNode; onClick: () => void; disabled?: boolean; tone?: 'primary' | 'ghost' | 'danger' }) {
  const style =
    tone === 'primary'
      ? 'bg-lime text-ink'
      : tone === 'danger'
        ? 'border border-bad/40 bg-bad/10 text-bad'
        : 'border border-line bg-surface-2 text-text hover:border-muted';
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition disabled:opacity-40 ${style}`}>
      {children}
    </button>
  );
}

const EVENT_TEXT: Record<MembershipEventDto['type'], (event: MembershipEventDto) => { title: string; detail: string }> = {
  sale: (event) => ({
    title: `${event.planName} paket satıldı`,
    detail: [event.method ? PAYMENT_METHOD_TEXT[event.method] : null, event.amountKurus !== null ? money(event.amountKurus) : null].filter(Boolean).join(' · '),
  }),
  freeze: (event) => ({ title: 'Üyelik donduruldu', detail: event.planName }),
  unfreeze: (event) => ({
    title: 'Dondurma kaldırıldı',
    detail: event.days ? `Bitiş tarihine ${event.days} gün eklendi` : 'Aynı gün kaldırıldı, gün eklenmedi',
  }),
  cancel: (event) => ({ title: 'Üyelik iptal edildi', detail: event.planName }),
};

const EVENT_ICON = { sale: Receipt, freeze: Snowflake, unfreeze: Sun, cancel: Ban } as const;
const EVENT_TONE = { sale: 'text-lime', freeze: 'text-info', unfreeze: 'text-ok', cancel: 'text-bad' } as const;

function HistoryRow({ event }: { event: MembershipEventDto }) {
  const { title, detail } = EVENT_TEXT[event.type](event);
  const Icon = EVENT_ICON[event.type];
  return (
    <li className="flex items-start gap-3 py-2.5">
      <Icon className={`mt-0.5 size-4 shrink-0 ${EVENT_TONE[event.type]}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text">{title}</p>
        {detail && <p className="text-xs text-muted">{detail}</p>}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-xs text-text">{dateTime(event.at)}</p>
        <p className="text-xs text-muted">{event.staffName}</p>
      </div>
    </li>
  );
}
