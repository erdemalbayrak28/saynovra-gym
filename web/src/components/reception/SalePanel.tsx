import { Check } from 'lucide-react';
import { useState } from 'react';
import { PAYMENT_METHOD_TEXT, type MembershipDetail, type PaymentMethod, type PlanDto } from '../../../../shared/contract';
import { addCalendarDays, calendarDate, gymToday, money } from '../../lib/format';
import { Label } from '../ui';

const METHODS: PaymentMethod[] = ['card', 'cash', 'transfer'];

interface Props {
  plans: PlanDto[];
  memberships: MembershipDetail[];
  busy: boolean;
  onSell: (planId: number, method: PaymentMethod) => void;
  onClose: () => void;
}

/** Mirrors the server's rule for the preview only: a renewal starts the day after the last active end date. */
function startDate(memberships: MembershipDetail[]): { date: string; renewal: boolean } {
  const lastEnd = memberships
    .filter((membership) => membership.status === 'active')
    .map((membership) => membership.endsOn)
    .sort()
    .at(-1);
  return lastEnd ? { date: addCalendarDays(lastEnd, 1), renewal: true } : { date: gymToday(), renewal: false };
}

export function SalePanel({ plans, memberships, busy, onSell, onClose }: Props) {
  const [planId, setPlanId] = useState<number | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('card');
  const plan = plans.find((p) => p.id === planId) ?? null;
  const start = startDate(memberships);
  const end = plan ? addCalendarDays(start.date, plan.durationDays - 1) : null;

  return (
    <div className="space-y-4 rounded-2xl border border-lime/30 bg-ink p-4">
      <div className="flex items-center justify-between">
        <Label className="text-lime">Paket satışı</Label>
        <button type="button" onClick={onClose} className="text-sm text-muted hover:text-text">
          Vazgeç
        </button>
      </div>

      <PlanPicker plans={plans} planId={planId} method={method} onPlan={setPlanId} onMethod={setMethod} />

      <p className="text-sm text-muted">
        {start.renewal ? 'Mevcut üyeliğin bitiminden sonra başlar: ' : 'Bugün başlar: '}
        <span className="text-text">{calendarDate(start.date)}</span>
        {end && (
          <>
            {' '}
            → <span className="text-text">{calendarDate(end)}</span>
          </>
        )}
      </p>

      <button
        type="button"
        disabled={!plan || busy}
        onClick={() => plan && onSell(plan.id, method)}
        className="w-full rounded-xl bg-lime px-4 py-2.5 text-sm font-bold text-ink transition disabled:opacity-40"
      >
        {plan ? `Satışı kaydet · ${money(plan.priceKurus)}` : 'Paket seçin'}
      </button>
      <p className="text-xs text-muted">Demo: gerçek ödeme alınmaz, satış ve ödeme kaydı tutulur.</p>
    </div>
  );
}

interface PickerProps {
  plans: PlanDto[];
  planId: number | null;
  method: PaymentMethod;
  onPlan: (planId: number) => void;
  onMethod: (method: PaymentMethod) => void;
}

/** Package cards and payment method; used by the sale panel and the new member form. */
export function PlanPicker({ plans, planId, method, onPlan, onMethod }: PickerProps) {
  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Paket">
        {plans.map((p) => {
          const chosen = p.id === planId;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={chosen}
              aria-label={`${p.name}, ${money(p.priceKurus)}, ${p.durationDays} gün`}
              onClick={() => onPlan(p.id)}
              className={`rounded-xl border p-3 text-left transition ${chosen ? 'border-lime bg-lime/10' : 'border-line bg-surface hover:border-muted'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-text">{p.name}</span>
                {chosen && <Check className="size-4 text-lime" />}
              </div>
              <div className="mt-1 font-display text-xl font-bold text-text">{money(p.priceKurus)}</div>
              <div className="text-xs text-muted">
                {p.durationDays} gün · {p.freezeDaysAllowed > 0 ? `${p.freezeDaysAllowed} gün dondurma` : 'Dondurma yok'}
              </div>
            </button>
          );
        })}
      </div>

      <div>
        <Label className="text-muted">Ödeme</Label>
        <div className="mt-2 inline-flex rounded-xl border border-line bg-surface p-1" role="radiogroup" aria-label="Ödeme yöntemi">
          {METHODS.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={m === method}
              onClick={() => onMethod(m)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${m === method ? 'bg-surface-2 text-text' : 'text-muted hover:text-text'}`}
            >
              {PAYMENT_METHOD_TEXT[m]}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
