import { useScrollToLine } from './useScrollToLine';

export function NumberedText({ text, line }: { text: string; line?: number }) {
  const lines = text.replace(/\n$/, '').split('\n');
  const target = useScrollToLine<HTMLTableRowElement>(line);
  return (
    <div className="scroll-thin overflow-auto rounded-xl border border-neutral-800 py-2 font-mono text-[12px] leading-relaxed text-neutral-300">
      <table className="w-full border-collapse"><tbody>
        {lines.map((l, i) => {
          const hit = i + 1 === line;
          return (
            <tr key={i} ref={hit ? target : undefined} aria-current={hit ? 'location' : undefined} className={hit ? 'bg-orange-500/10' : undefined}>
              <td className={`select-none whitespace-nowrap pl-3 pr-3 text-right align-top ${hit ? 'text-orange-400' : 'text-neutral-600'}`}>{i + 1}</td>
              <td className="whitespace-pre-wrap break-all pr-3">{l}</td>
            </tr>
          );
        })}
      </tbody></table>
    </div>
  );
}
