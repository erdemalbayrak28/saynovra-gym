import { ChevronDown } from 'lucide-react';
import { GatePanel } from '../components/GatePanel';
import { Label } from '../components/ui';
import type { StaffSession } from '../lib/session';
import { ReceptionPanel } from './Reception';

// The steps of the filmed walkthrough; collapsed so it stays out of the shot.
const SCRIPT = [
  'Telefonda QR Geçiş sekmesini açıp kameraya tut: kapı açılır, kayıt iki tarafa da düşer.',
  'Resepsiyonda kendi adını ara, üyeliği dondur: telefondaki üyelik kartı anında "Dondurulmuş" olur.',
  'Çıkış yapıp tekrar girmeyi dene: kapı "Üyelik dondurulmuş" der.',
  'Dondurmayı kaldır: dondurulan günler bitiş tarihine eklenir, kapı yeniden açılır.',
  'Mert Demir\'i ara (üyeliği dün bitti), 3 aylık paket sat: bugünkü ciro ve işlem geçmişi güncellenir.',
  'Salon sahibi PIN\'i ile girildiyse iptal düğmesi açıktır; gişe PIN\'inde kapalıdır.',
];

export function DemoView({ session, onUnauthorized }: { session: StaffSession; onUnauthorized: () => void }) {
  return (
    <div className="space-y-6">
      <details className="group rounded-2xl border border-line bg-surface px-5 py-3">
        <summary className="flex cursor-pointer list-none items-center justify-between">
          <Label className="text-muted">Prova akışı</Label>
          <ChevronDown className="size-4 text-muted transition group-open:rotate-180" />
        </summary>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-muted marker:text-lime">
          {SCRIPT.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </details>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <section aria-label="Kapı" className="min-w-0">
          <SectionTitle title="Kapı 01" caption="Turnike" />
          <GatePanel token={session.token} onUnauthorized={onUnauthorized} compact />
        </section>
        <section aria-label="Resepsiyon" className="min-w-0">
          <SectionTitle title="Resepsiyon" caption="Üyeler ve satış" />
          <ReceptionPanel session={session} onUnauthorized={onUnauthorized} compact />
        </section>
      </div>
    </div>
  );
}

function SectionTitle({ title, caption }: { title: string; caption: string }) {
  return (
    <div className="mb-3 flex items-baseline gap-3">
      <h2 className="font-display text-xl font-bold text-text">{title}</h2>
      <Label className="text-muted">{caption}</Label>
    </div>
  );
}
