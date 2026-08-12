export interface ProgressSegment {
  value: number;
  tone: 'orange' | 'green' | 'yellow' | 'neutral';
  label?: string;
}

interface ProgressBarProps {
  segments: ProgressSegment[];
  className?: string;
}

const fills: Record<ProgressSegment['tone'], string> = {
  green: 'bg-green-500/80',
  orange: 'bg-orange-500/80',
  yellow: 'bg-yellow-500/70',
  neutral: 'bg-neutral-600',
};

// Barra segmentada: cada segmento ocupa proporção do total. Total zero → trilho vazio.
export function ProgressBar({ segments, className = '' }: ProgressBarProps) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
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
