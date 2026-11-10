import { Search, UserPlus } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  EXPIRING_WITHIN_DAYS,
  MEMBER_SEARCH_MIN,
  type ActivationCodeResponse,
  type LiveEvent,
  type MemberDetail,
  type MemberListItem,
  type PaymentMethod,
  type PlanDto,
  type ReceptionSummary,
} from '../../../shared/contract';
import { MemberCard, type MembershipAction } from '../components/reception/MemberCard';
import { NewMemberPanel } from '../components/reception/NewMemberPanel';
import { MemberRow, ReceptionStats } from '../components/reception/parts';
import { Card, Label } from '../components/ui';
import { ApiError, api } from '../lib/api';
import { useLiveEvent } from '../lib/live';
import type { StaffSession } from '../lib/session';

const SEARCH_DELAY_MS = 250;

interface Props {
  session: StaffSession;
  onUnauthorized: () => void;
  /** Half-width column on the side-by-side screen: list and member stack until the screen is very wide. */
  compact?: boolean;
}

export function ReceptionPanel({ session, onUnauthorized, compact = false }: Props) {
  const { token } = session;
  const [summary, setSummary] = useState<ReceptionSummary | null>(null);
  const [plans, setPlans] = useState<PlanDto[]>([]);
  const [query, setQuery] = useState('');
  const [list, setList] = useState<MemberListItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<MemberDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  // Responses can arrive out of order; only the latest request of each kind may update the screen.
  const listRequest = useRef(0);
  const selectedRef = useRef<number | null>(null);

  const describe = useCallback(
    (err: unknown): string => {
      if (err instanceof ApiError && err.status === 401) onUnauthorized();
      return err instanceof ApiError ? err.message : 'Beklenmeyen hata';
    },
    [onUnauthorized],
  );

  const loadSummary = useCallback(() => {
    api.receptionSummary(token).then(setSummary, (err: unknown) => setLoadError(describe(err)));
  }, [token, describe]);

  const loadList = useCallback(
    (text: string) => {
      const id = ++listRequest.current;
      const trimmed = text.trim();
      setListLoading(true);
      (trimmed.length >= MEMBER_SEARCH_MIN ? api.searchMembers(token, trimmed) : api.expiringMembers(token))
        .then(
          (items) => {
            if (id !== listRequest.current) return;
            setList(items);
            setLoadError(null);
          },
          (err: unknown) => {
            if (id === listRequest.current) setLoadError(describe(err));
          },
        )
        .finally(() => {
          if (id === listRequest.current) setListLoading(false);
        });
    },
    [token, describe],
  );

  const loadDetail = useCallback(
    (memberId: number) => {
      api.member(token, memberId).then(
        (next) => {
          if (selectedRef.current === memberId) setDetail(next);
        },
        (err: unknown) => {
          if (selectedRef.current === memberId) setActionError(describe(err));
        },
      );
    },
    [token, describe],
  );

  useEffect(() => {
    loadSummary();
    api.plans(token).then(setPlans, (err: unknown) => setLoadError(describe(err)));
  }, [token, loadSummary, describe]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadList(query), query.trim() ? SEARCH_DELAY_MS : 0);
    return () => window.clearTimeout(timer);
  }, [query, loadList]);

  useLiveEvent((event: LiveEvent) => {
    if (event.type === 'membership' || event.type === 'member') {
      loadSummary();
      loadList(query);
      if (event.memberId === selectedId) loadDetail(event.memberId);
      return;
    }
    // Walking in or out changes "in the gym" and the visit count on the open card.
    if (event.type === 'checkin' && event.checkin.result === 'granted' && event.checkin.member?.id === selectedId) {
      loadDetail(event.checkin.member.id);
    }
  });

  const select = (memberId: number) => {
    setRegistering(false);
    selectedRef.current = memberId;
    setSelectedId(memberId);
    setActionError(null);
    if (detail?.member.id !== memberId) setDetail(null);
    loadDetail(memberId);
  };

  const run = async (change: () => Promise<MemberDetail>): Promise<boolean> => {
    setBusy(true);
    setActionError(null);
    try {
      const next = await change();
      if (selectedRef.current === next.member.id) setDetail(next);
      loadSummary();
      loadList(query);
      return true;
    } catch (err) {
      setActionError(describe(err));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const sell = (planId: number, method: PaymentMethod) =>
    detail ? run(() => api.sell(token, detail.member.id, { planId, method })) : Promise.resolve(false);
  const act = (membershipId: number, action: MembershipAction) => run(() => api.membershipAction(token, membershipId, action));
  const issueCode = async (): Promise<ActivationCodeResponse | null> => {
    if (!detail) return null;
    setBusy(true);
    setActionError(null);
    try {
      return await api.issueActivation(token, detail.member.id);
    } catch (err) {
      setActionError(describe(err));
      return null;
    } finally {
      setBusy(false);
    }
  };
  const startRegistration = () => {
    selectedRef.current = null;
    setSelectedId(null);
    setDetail(null);
    setRegistering(true);
  };

  const searching = query.trim().length >= MEMBER_SEARCH_MIN;
  // In the half-width column the list sits above the member until the screen is very wide.
  const columns = compact ? 'min-[1800px]:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]' : 'lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]';
  const listHeight = compact ? 'max-h-72 min-[1800px]:max-h-[60vh]' : 'max-h-[60vh]';

  return (
    <div className="space-y-6">
      <ReceptionStats summary={summary} />
      <div className={`grid items-start gap-6 ${columns}`}>
        <Card>
          <div className="flex gap-2">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-ink px-3 py-2.5 focus-within:border-lime">
              <Search className="size-4 shrink-0 text-muted" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ad, soyad veya telefon"
                className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-muted"
                aria-label="Üye ara"
              />
            </label>
            <button
              type="button"
              onClick={startRegistration}
              aria-pressed={registering}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold transition ${registering ? 'border border-lime/60 bg-lime/10 text-lime' : 'bg-lime text-ink hover:brightness-105'}`}
            >
              <UserPlus className="size-4" /> Yeni üye
            </button>
          </div>
          <div className="mb-2 mt-4 flex items-center justify-between">
            <Label className="text-text">{searching ? 'Arama sonuçları' : `${EXPIRING_WITHIN_DAYS} gün içinde bitenler`}</Label>
            {listLoading && <Label className="text-muted">Yükleniyor</Label>}
          </div>
          {loadError && <p className="mb-2 rounded-xl border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad">{loadError}</p>}
          {list.length === 0 && !listLoading ? (
            <p className="py-6 text-center text-sm text-muted">{searching ? 'Eşleşen üye yok.' : 'Bu hafta biten, yenilenmemiş üyelik yok.'}</p>
          ) : (
            <div className={`-mx-2 space-y-1 overflow-y-auto px-2 ${listHeight}`}>
              {list.map((member) => (
                <MemberRow key={member.id} member={member} selected={member.id === selectedId} onSelect={select} />
              ))}
            </div>
          )}
        </Card>

        {registering ? (
          <NewMemberPanel
            token={token}
            plans={plans}
            describe={describe}
            onCreated={() => {
              loadSummary();
              loadList(query);
            }}
            onOpenMember={select}
            onClose={() => setRegistering(false)}
          />
        ) : detail ? (
          <MemberCard
            detail={detail}
            plans={plans}
            role={session.staff.role}
            busy={busy}
            error={actionError}
            onSell={sell}
            onAction={act}
            onIssueCode={issueCode}
          />
        ) : (
          <Card className="grid min-h-48 place-items-center text-center">
            <div>
              <p className="font-semibold text-text">{selectedId ? 'Üye yükleniyor' : 'Bir üye seçin'}</p>
              <p className="mt-1 text-sm text-muted">Ad, soyad ya da telefonla arayın; listeden seçtiğiniz üyenin paketini satabilir, dondurabilir veya iptal edebilirsiniz. Salona ilk kez gelen için "Yeni üye".</p>
              {actionError && <p className="mt-3 text-sm text-bad">{actionError}</p>}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
