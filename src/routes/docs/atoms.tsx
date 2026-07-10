import { Icon } from '../../components/primitives';
import { RESOURCES, type IconName } from '../docs.data';

// Átomos de layout da documentação. Puramente presentacionais — sem estado nem
// dados do backend. Reusados pelas seções em ./sections.tsx.

export function SectionTitle({ icon, kicker, title, desc }: { icon: IconName; kicker: string; title: string; desc: string }) {
  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-orange-500/30 bg-orange-500/10 text-orange-300">
          <Icon name={icon} size={17} />
        </span>
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-orange-400/70">{kicker}</span>
      </div>
      <h2 className="text-[22px] font-semibold tracking-tight text-neutral-100">{title}</h2>
      <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-neutral-400">{desc}</p>
    </div>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5 transition hairline hover:border-neutral-700/80 ${className}`}>
      {children}
    </div>
  );
}

export function FeatureCard({ icon, tone, title, children }: { icon: IconName; tone: string; title: string; children: React.ReactNode }) {
  return (
    <Card className="group">
      <div className="mb-3 flex items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${tone}`}>
          <Icon name={icon} size={18} />
        </span>
        <h3 className="text-[14.5px] font-semibold text-neutral-100">{title}</h3>
      </div>
      <p className="text-[13px] leading-relaxed text-neutral-400">{children}</p>
    </Card>
  );
}

export function Pill({ children }: { children: React.ReactNode }) {
  return <code className="rounded-md border border-neutral-700/60 bg-neutral-950 px-1.5 py-0.5 font-mono text-[11.5px] text-orange-300/90">{children}</code>;
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="inline-flex min-w-[22px] items-center justify-center rounded-md border border-neutral-700 bg-neutral-950 px-1.5 py-0.5 font-mono text-[11px] text-neutral-300 shadow-[0_1px_0_rgba(0,0,0,0.6)]">{children}</kbd>;
}

export function InfoCard({ icon, iconClass = 'text-orange-300', size = 15, title, className = '', children }: { icon: IconName; iconClass?: string; size?: number; title: string; className?: string; children: React.ReactNode }) {
  return (
    <Card className={className}>
      <div className="mb-2 flex items-center gap-2">
        <Icon name={icon} size={size} className={iconClass} />
        <h3 className="text-[14px] font-semibold text-neutral-100">{title}</h3>
      </div>
      <p className="text-[13px] leading-relaxed text-neutral-400">{children}</p>
    </Card>
  );
}

export function StepCard({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-orange-500/15 text-[11px] font-semibold text-orange-300">{step}</span>
        <h3 className="text-[14px] font-semibold text-neutral-100">{title}</h3>
      </div>
      <div className="text-[13px] leading-relaxed text-neutral-400">{children}</div>
    </Card>
  );
}

const CALLOUT_TONES = {
  amber: { box: 'border-amber-500/20 bg-amber-500/[0.06]', icon: 'text-amber-400/80', text: 'text-amber-200/80' },
  sky: { box: 'border-sky-500/20 bg-sky-500/[0.06]', icon: 'text-sky-400/80', text: 'text-sky-200/80' },
  red: { box: 'border-red-500/25 bg-red-500/[0.07]', icon: 'text-red-400/80', text: 'text-red-200/80' },
} as const;

export function Callout({ icon, tone, children }: { icon: IconName; tone: keyof typeof CALLOUT_TONES; children: React.ReactNode }) {
  const t = CALLOUT_TONES[tone];
  return (
    <div className={`mt-3 flex items-start gap-2.5 rounded-xl border ${t.box} p-4`}>
      <Icon name={icon} size={15} className={`mt-0.5 shrink-0 ${t.icon}`} />
      <p className={`text-[12.5px] leading-relaxed ${t.text}`}>{children}</p>
    </div>
  );
}

export function ResourceRow({ r }: { r: typeof RESOURCES[number] }) {
  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex shrink-0 items-center gap-3 sm:w-44">
          <span className={`flex h-12 w-12 items-center justify-center rounded-xl border font-mono text-[12px] font-bold ${r.tone}`}>
            {r.key}
          </span>
          <div>
            <div className="text-[14px] font-semibold text-neutral-100">{r.label}</div>
            <div className="mt-0.5 text-[10.5px] text-neutral-500">fonte: <Pill>{r.source}</Pill></div>
          </div>
        </div>
        <div className="flex-1 space-y-2.5">
          <p className="text-[13px] leading-relaxed text-neutral-300"><span className="font-medium text-neutral-200">O que é · </span>{r.what}</p>
          <p className="text-[12.5px] leading-relaxed text-neutral-500"><span className="font-medium text-neutral-400">Como é puxado · </span>{r.how}</p>
        </div>
      </div>
    </Card>
  );
}
