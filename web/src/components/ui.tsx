import type { ReactNode } from 'react';

export function Label({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono text-[11px] uppercase tracking-[0.14em] ${className}`}>{children}</span>;
}

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <div
      className="grid shrink-0 place-items-center rounded-xl border border-lime/40 bg-surface shadow-[0_0_15px_rgb(200_240_49/0.15)]"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <span className="font-display text-lg font-bold tracking-tighter">
        <span className="text-text">N</span>
        <span className="text-lime">G</span>
      </span>
    </div>
  );
}

export function Wordmark({ caption }: { caption?: string }) {
  return (
    <div className="flex items-center gap-3">
      <Logo />
      <div>
        <div className="font-display text-lg font-bold leading-tight tracking-tight">
          NOVRA <span className="text-lime">GYM</span>
        </div>
        <Label className="text-muted">{caption ?? 'Powered by SAYNOVRA'}</Label>
      </div>
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-line bg-surface p-5 ${className}`}>{children}</section>;
}

export function Initials({ text, highlight = false }: { text: string; highlight?: boolean }) {
  return (
    <span
      className={`grid size-8 shrink-0 place-items-center rounded-lg font-display text-xs font-bold ${
        highlight ? 'bg-lime text-ink' : 'border border-line bg-surface-2 text-text'
      }`}
    >
      {text}
    </span>
  );
}
