const TONE: Record<string, string> = {
  '+': 'bg-emerald-500/10 text-emerald-300',
  '-': 'bg-red-500/10 text-red-300',
  '@': 'text-sky-400',
};

export function DiffView({ text }: { text: string }) {
  if (!text) return <p className="p-3 text-[13px] text-neutral-500">Sem diferenças entre as duas versões.</p>;
  return (
    <pre className="scroll-thin max-h-72 overflow-auto rounded-lg border border-neutral-800 bg-neutral-950 p-2 font-mono text-[12px] leading-relaxed">
      {text.split('\n').map((line, i) => (
        <div key={i} className={`whitespace-pre-wrap break-all px-1 ${TONE[line[0]] ?? 'text-neutral-400'}`}>{line || ' '}</div>
      ))}
    </pre>
  );
}
