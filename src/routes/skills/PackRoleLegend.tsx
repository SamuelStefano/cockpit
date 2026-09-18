const ITEMS = [
  ['bg-orange-400', 'raiz'],
  ['bg-sky-400', 'obrigatória'],
  ['bg-neutral-400', 'opcional'],
  ['bg-neutral-600', 'sugerida (fora por padrão)'],
] as const;

export function PackRoleLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-neutral-500">
      {ITEMS.map(([dot, label]) => (
        <span key={label} className="flex items-center gap-1.5"><span className={`h-1.5 w-1.5 rounded-full ${dot}`} />{label}</span>
      ))}
    </div>
  );
}
