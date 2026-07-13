import type { ReactNode } from 'react';
import { Icon } from '../components/primitives';

// Átomos visuais do painel admin (sem lógica de negócio): extraídos do Admin.tsx
// p/ manter um componente por arquivo e a rota abaixo de 150 linhas.

export function Stat({ label, value, icon, tone }: { label: string; value: string; icon: Parameters<typeof Icon>[0]['name']; tone?: 'ok' | 'warn' }) {
  const color = tone === 'ok' ? 'text-emerald-400' : tone === 'warn' ? 'text-yellow-400' : 'text-neutral-100';
  const chip = tone === 'ok' ? 'bg-emerald-500/10 text-emerald-400/80' : tone === 'warn' ? 'bg-yellow-500/10 text-yellow-400/80' : 'bg-orange-500/10 text-orange-400/80';
  return (
    <div className="hairline flex flex-col gap-2 rounded-xl border border-neutral-800 bg-neutral-900/40 px-4 py-3.5 transition hover:border-neutral-700 hover:bg-neutral-900/70">
      <span className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wide text-neutral-500">
        <span className={`flex h-4 w-4 items-center justify-center rounded-[5px] ${chip}`}>
          <Icon name={icon} size={11} />
        </span>
        {label}
      </span>
      <span className={`font-mono text-[20px] font-semibold tabular-nums tracking-tight ${color}`}>{value}</span>
    </div>
  );
}

export function Dot({ on }: { on: boolean }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${on ? 'bg-emerald-400' : 'bg-red-400'}`} />;
}

export function Chip({ label, on = true, muted }: { label: string; on?: boolean; muted?: string }) {
  const tone = on
    ? 'border-orange-500/20 bg-orange-500/10 text-orange-200/90'
    : 'border-neutral-800 bg-neutral-900/60 text-neutral-600 line-through';
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[12px] ${tone}`}>
      {label}
      {muted ? <span className="text-[10px] uppercase tracking-wide opacity-60">{muted}</span> : null}
    </span>
  );
}

export function Inv({ icon, title, count, children }: { icon: Parameters<typeof Icon>[0]['name']; title: string; count: number; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 hairline">
      <h3 className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
        <Icon name={icon} size={12} /> {title} <span className="text-neutral-600">· {count}</span>
      </h3>
      {count === 0 ? <span className="text-[12px] text-neutral-600">nenhum</span> : <div className="flex flex-wrap gap-1.5">{children}</div>}
    </div>
  );
}
