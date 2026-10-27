// Hints carry commands in backticks: those render as code the owner can copy.
export function HealthHint({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/);
  return (
    <p className="mt-0.5 text-[11.5px] leading-snug text-neutral-400">
      {parts.map((p, i) => (p.startsWith('`') && p.endsWith('`') && p.length > 2
        ? <code key={i} className="break-all rounded bg-neutral-800 px-1 font-mono text-[11px] text-neutral-200">{p.slice(1, -1)}</code>
        : <span key={i}>{p}</span>))}
    </p>
  );
}
