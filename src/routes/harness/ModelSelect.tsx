import type { HarnessNativeModel } from '../../../shared/protocol';

interface Props {
  value: string;
  onChange: (v: string) => void;
  models: HarnessNativeModel[];
  label: string;
}

// Select nativo estilizado (não há primitivo Select). Usado pra escolher modelo
// nativo Anthropic em vários pontos do composer.
export function ModelSelect({ value, onChange, models, label }: Props) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10.5px] font-medium uppercase tracking-[0.12em] text-neutral-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-[12.5px] text-neutral-200 outline-none transition focus:border-orange-500/40 focus:ring-2 focus:ring-orange-500/15"
      >
        {models.map((m) => (
          <option key={m.id} value={m.id}>{m.label}</option>
        ))}
      </select>
    </label>
  );
}
