import { ArrowLeft, ArrowRight, Check, UserPlus } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ACCOUNT_ROLE_TEXT,
  MEMBER_GENDER_TEXT,
  MEMBER_GOAL_TEXT,
  type AccountRole,
  type ActivationCodeResponse,
  type CreateMemberResponse,
  type MemberGender,
  type MemberGoal,
  type MemberListItem,
  type NewMemberProfile,
  type PaymentMethod,
  type PlanDto,
  type StaffRole,
} from '../../../../shared/contract';
import {
  KVKK_NOTICE_PARAGRAPHS,
  KVKK_NOTICE_TITLE,
  KVKK_NOTICE_VERSION,
  KVKK_TRAINER_NOTICE_PARAGRAPHS,
  KVKK_TRAINER_NOTICE_TITLE,
  KVKK_TRAINER_NOTICE_VERSION,
  OPTIONAL_DATA_TEXT,
  OPTIONAL_DATA_TITLE,
} from '../../../../shared/consent';
import { ApiError, api } from '../../lib/api';
import { money } from '../../lib/format';
import { Card, Label } from '../ui';
import { ActivationCode } from './ActivationCode';
import { PlanPicker } from './SalePanel';

type Step = 'info' | 'kvkk' | 'package' | 'code';
const STEP_TITLE: Record<Step, string> = { info: 'Bilgiler', kvkk: 'KVKK', package: 'Paket', code: 'Kod' };
// A trainer account has no package.
const STEPS: Record<AccountRole, Step[]> = {
  member: ['info', 'kvkk', 'package', 'code'],
  trainer: ['info', 'kvkk', 'code'],
};
const NOTICE = {
  member: { title: KVKK_NOTICE_TITLE, paragraphs: KVKK_NOTICE_PARAGRAPHS, version: KVKK_NOTICE_VERSION, who: 'Üye' },
  trainer: { title: KVKK_TRAINER_NOTICE_TITLE, paragraphs: KVKK_TRAINER_NOTICE_PARAGRAPHS, version: KVKK_TRAINER_NOTICE_VERSION, who: 'Eğitmen' },
} as const;
const DUPLICATE_CHECK_DELAY_MS = 300;

/** Same normalisation as the server: "0555...", "+90 555..." and "555..." all become "555...". */
function nationalPhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('90')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^5\d{9}$/.test(digits) ? digits : null;
}

/** Empty text is "not given"; anything else must be a number in range. */
function optionalNumber(text: string, min: number, max: number, integer: boolean): number | null | 'invalid' {
  const trimmed = text.trim().replace(',', '.');
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) return 'invalid';
  return value;
}

interface Props {
  token: string;
  plans: PlanDto[];
  /** Only the owner may open trainer accounts. */
  staffRole: StaffRole;
  describe: (err: unknown) => string;
  /** Account opened (the code step is showing); the list and summary refresh. */
  onCreated: (memberId: number) => void;
  onOpenMember: (memberId: number) => void;
  onClose: () => void;
}

export function NewMemberPanel({ token, plans, staffRole, describe, onCreated, onOpenMember, onClose }: Props) {
  const [step, setStep] = useState<Step>('info');
  const [role, setRole] = useState<AccountRole>('member');
  const isTrainer = role === 'trainer';
  const notice = NOTICE[role];
  const [fullName, setFullName] = useState('');
  const [phoneText, setPhoneText] = useState('');
  const [existing, setExisting] = useState<MemberListItem | null>(null);
  const [noticeRead, setNoticeRead] = useState(false);
  const [optionalData, setOptionalData] = useState(false);
  const [birthYear, setBirthYear] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [gender, setGender] = useState<MemberGender | null>(null);
  const [goal, setGoal] = useState<MemberGoal | null>(null);
  const [planId, setPlanId] = useState<number | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('card');
  const [created, setCreated] = useState<CreateMemberResponse | null>(null);
  const [activation, setActivation] = useState<ActivationCodeResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nationalNumber = nationalPhone(phoneText);
  const nameValid = fullName.trim().length >= 2;

  // Warn before the desk types everything twice for someone who already has an account.
  useEffect(() => {
    setExisting(null);
    if (!nationalNumber) return;
    let current = true;
    const timer = window.setTimeout(() => {
      api.searchMembers(token, nationalNumber).then(
        (found) => current && setExisting(found.find((m) => m.phone === nationalNumber) ?? null),
        () => undefined, // The server refuses duplicates anyway; the warning is a convenience.
      );
    }, DUPLICATE_CHECK_DELAY_MS);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [nationalNumber, token]);

  const parsed = {
    birthYear: optionalNumber(birthYear, 1920, 2015, true),
    heightCm: optionalNumber(height, 120, 230, true),
    weightKg: optionalNumber(weight, 30, 250, false),
  };
  const withOptional = optionalData && !isTrainer;
  const optionalValid = !withOptional || Object.values(parsed).every((value) => value !== 'invalid');
  const profile: NewMemberProfile = withOptional
    ? {
        birthYear: parsed.birthYear === 'invalid' ? null : parsed.birthYear,
        heightCm: parsed.heightCm === 'invalid' ? null : parsed.heightCm,
        weightKg: parsed.weightKg === 'invalid' ? null : parsed.weightKg,
        gender,
        goal,
      }
    : { birthYear: null, heightCm: null, weightKg: null, gender: null, goal: null };
  const plan = plans.find((p) => p.id === planId) ?? null;

  const submit = async () => {
    if (!nationalNumber) return;
    setBusy(true);
    setError(null);
    try {
      const response = await api.createMember(token, {
        role,
        fullName: fullName.trim(),
        phone: nationalNumber,
        noticeVersion: notice.version,
        consents: { notice: true, optionalData: withOptional },
        profile,
        sale: plan && !isTrainer ? { planId: plan.id, method } : null,
      });
      setCreated(response);
      setActivation(response.activation);
      setStep('code');
      onCreated(response.detail.member.id);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 409 ? 'Bu numarayla kayıtlı bir üye var. Mevcut üyeyi açın.' : describe(err));
    } finally {
      setBusy(false);
    }
  };

  const renew = async () => {
    if (!created) return;
    setBusy(true);
    setError(null);
    try {
      setActivation(await api.issueActivation(token, created.detail.member.id));
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-lime text-ink">
            <UserPlus className="size-5" />
          </span>
          <div>
            <h2 className="font-display text-xl font-bold text-text">{isTrainer ? 'Yeni eğitmen' : 'Yeni üye'}</h2>
            <Label className="text-muted">Hesabı resepsiyon açar, şifreyi kişi kendi belirler</Label>
          </div>
        </div>
        {step !== 'code' && (
          <button type="button" onClick={onClose} className="text-sm text-muted hover:text-text">
            Vazgeç
          </button>
        )}
      </div>

      <Stepper steps={STEPS[role]} current={step} />

      {step === 'info' && (
        <div className="space-y-4">
          <div>
            <Label className="text-muted">Hesap türü</Label>
            <div className="mt-1.5 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Hesap türü">
              {(['member', 'trainer'] as const).map((option) => {
                const locked = option === 'trainer' && staffRole !== 'owner';
                const chosen = role === option;
                return (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={chosen}
                    disabled={locked}
                    onClick={() => setRole(option)}
                    className={`rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${chosen ? 'border-lime bg-lime/10' : 'border-line bg-ink hover:border-muted'}`}
                  >
                    <span className={`block font-semibold ${chosen ? 'text-lime' : 'text-text'}`}>{ACCOUNT_ROLE_TEXT[option]}</span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {option === 'member' ? 'Paket alır, antrenman yapar, kapıdan üyeliğiyle geçer.' : 'Kendi üyelerini izler, program atar; üyeliği olmaz.'}
                    </span>
                  </button>
                );
              })}
            </div>
            {staffRole !== 'owner' && <p className="mt-1.5 text-xs text-muted">Eğitmen hesabını yalnızca salon sahibi açabilir.</p>}
          </div>
          <Field label="Ad soyad">
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={80} autoFocus className={INPUT} placeholder="Deniz Yılmaz" />
          </Field>
          <Field label="Cep telefonu" hint={phoneText && !nationalNumber ? '5 ile başlayan 10 haneli numara' : undefined}>
            <input value={phoneText} onChange={(e) => setPhoneText(e.target.value)} inputMode="tel" maxLength={20} className={`${INPUT} font-mono`} placeholder="0555 000 00 00" />
          </Field>
          {existing && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-bad/30 bg-bad/10 px-3 py-2.5" role="alert">
              <p className="text-sm text-text">
                Bu numara <span className="font-semibold">{existing.fullName}</span> adına kayıtlı.
              </p>
              <button type="button" onClick={() => onOpenMember(existing.id)} className="text-sm font-semibold text-lime hover:underline">
                Üyeyi aç
              </button>
            </div>
          )}
          <p className="text-xs text-muted">Kimlik numarası istenmez. Telefon, uygulamaya giriş numarası olur.</p>
          <Nav next={{ label: 'KVKK', disabled: !nameValid || !nationalNumber || existing !== null, onClick: () => setStep('kvkk') }} />
        </div>
      )}

      {step === 'kvkk' && (
        <div className="space-y-4">
          <div className="max-h-56 overflow-y-auto rounded-xl border border-line bg-ink p-4">
            <p className="font-semibold text-text">{notice.title}</p>
            {notice.paragraphs.map((paragraph) => (
              <p key={paragraph} className="mt-2 text-sm text-muted">
                {paragraph}
              </p>
            ))}
            <Label className="mt-3 block text-muted">Metin sürümü {notice.version}</Label>
          </div>
          <ConsentCheck checked={noticeRead} onChange={setNoticeRead} required>
            {notice.who} aydınlatma metnini okudu (zorunlu)
          </ConsentCheck>
          {!isTrainer && (
            <ConsentCheck checked={optionalData} onChange={setOptionalData}>
              <span className="font-semibold text-text">{OPTIONAL_DATA_TITLE}</span>
              <span className="mt-1 block text-xs text-muted">{OPTIONAL_DATA_TEXT}</span>
            </ConsentCheck>
          )}

          {withOptional && (
            <div className="grid gap-3 rounded-xl border border-line bg-ink p-4 sm:grid-cols-3">
              <Field label="Doğum yılı" hint={parsed.birthYear === 'invalid' ? '1920-2015' : undefined}>
                <input value={birthYear} onChange={(e) => setBirthYear(e.target.value)} inputMode="numeric" maxLength={4} className={INPUT} placeholder="1994" />
              </Field>
              <Field label="Boy (cm)" hint={parsed.heightCm === 'invalid' ? '120-230' : undefined}>
                <input value={height} onChange={(e) => setHeight(e.target.value)} inputMode="numeric" maxLength={3} className={INPUT} placeholder="175" />
              </Field>
              <Field label="Kilo (kg)" hint={parsed.weightKg === 'invalid' ? '30-250' : undefined}>
                <input value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" maxLength={5} className={INPUT} placeholder="72,5" />
              </Field>
              <Choice label="Cinsiyet" options={MEMBER_GENDER_TEXT} value={gender} onChange={setGender} />
              <Choice label="Hedef" options={MEMBER_GOAL_TEXT} value={goal} onChange={setGoal} wide />
            </div>
          )}
          {isTrainer && error && <ErrorBox>{error}</ErrorBox>}
          {isTrainer ? (
            <Nav back={() => setStep('info')} next={{ label: busy ? 'Kaydediliyor' : 'Eğitmen hesabını aç', disabled: busy || !noticeRead, onClick: submit, final: true }} />
          ) : (
            <Nav back={() => setStep('info')} next={{ label: 'Paket', disabled: !noticeRead || !optionalValid, onClick: () => setStep('package') }} />
          )}
        </div>
      )}

      {step === 'package' && (
        <div className="space-y-4">
          <PlanPicker plans={plans} planId={planId} method={method} onPlan={(id) => setPlanId(id === planId ? null : id)} onMethod={setMethod} />
          <p className="text-sm text-muted">
            {plan ? (
              <>
                Bugün başlar. <span className="text-text">{money(plan.priceKurus)}</span> {method === 'card' ? 'kartla' : method === 'cash' ? 'nakit' : 'havaleyle'} kaydedilir.
              </>
            ) : (
              'Paket seçmeden de kayıt açılabilir; paket sonra üye kartından satılır. Seçili paketi kaldırmak için yeniden tıklayın.'
            )}
          </p>
          {error && <ErrorBox>{error}</ErrorBox>}
          <Nav
            back={() => setStep('kvkk')}
            next={{ label: busy ? 'Kaydediliyor' : plan ? `Kaydı aç · ${money(plan.priceKurus)}` : 'Kaydı paketsiz aç', disabled: busy, onClick: submit, final: true }}
          />
          <p className="text-xs text-muted">Hesap, rıza kaydı ve satış birlikte yazılır; biri başarısız olursa hiçbiri yazılmaz. Demo: gerçek ödeme alınmaz.</p>
        </div>
      )}

      {step === 'code' && created && activation && (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            <span className="font-semibold text-text">{created.detail.member.fullName}</span> kaydedildi
            {isTrainer ? ' (eğitmen). Üye kartlarından üye atayabilirsiniz.' : created.detail.current ? `, ${created.detail.current.planName} paketi başladı.` : ', henüz paketi yok.'}
          </p>
          <ActivationCode activation={activation} memberPhone={created.detail.member.phone} busy={busy} onRenew={renew} />
          {error && <ErrorBox>{error}</ErrorBox>}
          <button
            type="button"
            onClick={() => onOpenMember(created.detail.member.id)}
            className="w-full rounded-xl bg-lime px-4 py-2.5 text-sm font-bold text-ink transition hover:brightness-105"
          >
            {isTrainer ? 'Eğitmen kartını aç' : 'Üye kartını aç'}
          </button>
        </div>
      )}
    </Card>
  );
}

const INPUT =
  'w-full rounded-xl border border-line bg-ink px-3 py-2.5 text-sm text-text outline-none transition placeholder:text-muted focus:border-lime';

function Stepper({ steps, current }: { steps: Step[]; current: Step }) {
  const index = steps.indexOf(current);
  return (
    <ol className="flex gap-2" aria-label="Kayıt adımları">
      {steps.map((id, i) => {
        const state = i < index ? 'done' : i === index ? 'current' : 'next';
        return (
          <li key={id} aria-current={state === 'current' ? 'step' : undefined} className="min-w-0 flex-1">
            <div className={`h-1 rounded-full ${state === 'next' ? 'bg-line' : 'bg-lime'}`} />
            <Label className={`mt-1.5 block truncate ${state === 'current' ? 'text-lime' : state === 'done' ? 'text-text' : 'text-muted'}`}>
              {i + 1} · {STEP_TITLE[id]}
            </Label>
          </li>
        );
      })}
    </ol>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <Label className="text-muted">{label}</Label>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="mt-1 block text-xs text-bad">{hint}</span>}
    </label>
  );
}

function ConsentCheck({ checked, onChange, required = false, children }: { checked: boolean; onChange: (value: boolean) => void; required?: boolean; children: ReactNode }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${checked ? 'border-lime/50 bg-lime/5' : 'border-line hover:border-muted'}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} required={required} className="peer sr-only" />
      <span
        className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border transition peer-focus-visible:ring-2 peer-focus-visible:ring-lime ${
          checked ? 'border-lime bg-lime text-ink' : 'border-muted'
        }`}
        aria-hidden
      >
        {checked && <Check className="size-3.5" />}
      </span>
      <span className="min-w-0 text-sm text-text">{children}</span>
    </label>
  );
}

function Choice<T extends string>({ label, options, value, onChange, wide = false }: { label: string; options: Record<T, string>; value: T | null; onChange: (value: T | null) => void; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <Label className="text-muted">{label}</Label>
      <div className="mt-1.5 flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
        {(Object.entries(options) as [T, string][]).map(([key, text]) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={value === key}
            onClick={() => onChange(value === key ? null : key)}
            className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${value === key ? 'border-lime bg-lime/10 text-lime' : 'border-line text-muted hover:text-text'}`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function Nav({ back, next }: { back?: () => void; next: { label: string; disabled: boolean; onClick: () => void; final?: boolean } }) {
  return (
    <div className="flex items-center justify-between gap-3 pt-1">
      {back ? (
        <button type="button" onClick={back} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-text">
          <ArrowLeft className="size-4" /> Geri
        </button>
      ) : (
        <span />
      )}
      <button
        type="button"
        onClick={next.onClick}
        disabled={next.disabled}
        className="inline-flex items-center gap-1.5 rounded-xl bg-lime px-4 py-2.5 text-sm font-bold text-ink transition hover:brightness-105 disabled:opacity-40"
      >
        {next.label} {!next.final && <ArrowRight className="size-4" />}
      </button>
    </div>
  );
}

function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad" role="alert">
      {children}
    </p>
  );
}
