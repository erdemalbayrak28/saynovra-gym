import {
  MEMBERSHIP_STATUS_TEXT,
  PAYMENT_METHOD_TEXT,
  type MemberListItem,
  type MembershipStatus,
  type PaymentMethod,
  type ReceptionSummary,
} from '../../../../shared/contract';
import { daysLeftText, money, phone } from '../../lib/format';
import { Initials, Label } from '../ui';

const STATUS_TONE: Record<MembershipStatus, string> = {
  active: 'border-ok/30 bg-ok/10 text-ok',
  frozen: 'border-info/30 bg-info/10 text-info',
  expired: 'border-bad/30 bg-bad/10 text-bad',
  cancelled: 'border-line bg-surface-2 text-muted',
};

export function StatusPill({ status }: { status: MembershipStatus }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[status]}`}>
      {MEMBERSHIP_STATUS_TEXT[status]}
    </span>
  );
}

export function RolePill() {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full border border-lime/40 bg-lime/10 px-2 py-0.5 text-xs font-semibold text-lime">
      Eğitmen
    </span>
  );
}

export function ReceptionStats({ summary }: { summary: ReceptionSummary | null }) {
  const methods = summary
    ? (Object.entries(summary.byMethod) as [PaymentMethod, number][])
        .filter(([, total]) => total > 0)
        .map(([method, total]) => `${PAYMENT_METHOD_TEXT[method]} ${money(total)}`)
        .join(' · ')
    : '';
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Tile label="Bugünkü ciro" value={summary ? money(summary.todayRevenueKurus) : '-'} hint={summary ? `${summary.todaySales} satış${methods ? ` · ${methods}` : ''}` : ''} />
      <Tile label="Aktif üye" value={summary ? `${summary.activeMembers}` : '-'} />
      <Tile label="Dondurulmuş" value={summary ? `${summary.frozenMembers}` : '-'} tone="info" />
      <Tile label="Bu hafta bitecek" value={summary ? `${summary.expiringSoon}` : '-'} hint="Yenilenmemiş" tone="bad" />
    </div>
  );
}

function Tile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'info' | 'bad' }) {
  const color = tone === 'info' ? 'text-info' : tone === 'bad' ? 'text-bad' : 'text-lime';
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-surface p-4">
      <Label className="text-muted">{label}</Label>
      <div className={`mt-1 truncate font-display text-2xl font-bold sm:text-3xl ${color}`}>{value}</div>
      {hint && <p className="mt-0.5 truncate text-xs text-muted" title={hint}>{hint}</p>}
    </div>
  );
}

export function MemberRow({ member, selected, onSelect }: { member: MemberListItem; selected: boolean; onSelect: (id: number) => void }) {
  const membership = member.membership;
  return (
    <button
      type="button"
      onClick={() => onSelect(member.id)}
      aria-pressed={selected}
      className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition ${
        selected ? 'border-lime/60 bg-lime/5' : 'border-transparent hover:bg-surface-2'
      }`}
    >
      <Initials text={member.initials} highlight={selected} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-semibold text-text">{member.fullName}</span>
          {member.isInside && <span className="size-1.5 shrink-0 rounded-full bg-ok" title="Salonda" aria-label="Salonda" />}
          {!member.activated && <span className="shrink-0 rounded-full bg-info/10 px-1.5 text-[10px] font-semibold text-info" title="Uygulamaya girmedi">Yeni</span>}
        </span>
        <span className="block truncate font-mono text-xs text-muted">{phone(member.phone)}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        {member.role === 'trainer' ? <RolePill /> : membership ? <StatusPill status={membership.status} /> : <span className="text-xs text-muted">Üyelik yok</span>}
        {membership?.status === 'active' && <span className="text-xs text-muted">{daysLeftText(membership.daysLeft)}</span>}
      </span>
    </button>
  );
}
