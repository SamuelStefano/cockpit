export interface ProgressSegment {
  value: number;
  tone: 'orange' | 'green' | 'yellow' | 'red' | 'neutral';
  label?: string;
}

interface ProgressBarProps {
  segments: ProgressSegment[];
  // Sem `max` a barra é uma composição (cada fatia é % do total, trilho sempre
  // cheio). Com `max` ela vira medidor: 30 de 100 pinta 30% e deixa trilho à mostra.
  max?: number;
  className?: string;
}

const fills: Record<ProgressSegment['tone'], string> = {
  green: 'bg-emerald-500/80',
  orange: 'bg-orange-500/80',
  yellow: 'bg-amber-500/80',
  red: 'bg-red-500/80',
  neutral: 'bg-neutral-600',
};

// Barra segmentada: cada segmento ocupa proporção do total. Total zero → trilho vazio.
export function ProgressBar({ segments, max, className = '' }: ProgressBarProps) {
  const sum = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  const total = max && max > 0 ? max : sum;
  return (
    <div className={`flex h-1.5 w-full overflow-hidden rounded-full bg-neutral-800 ${className}`}>
      {total > 0 && segments.map((s, i) => {
        const pct = (Math.max(0, s.value) / total) * 100;
        if (pct <= 0) return null;
        return <div key={i} className={fills[s.tone]} style={{ width: `${pct}%` }} title={s.label} />;
      })}
    </div>
  );
}
