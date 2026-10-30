interface Line { who: string; text: string }

export function SalaFeed({ lines }: { lines: Line[] }) {
  if (lines.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1 border-t border-neutral-800 px-4 py-2">
      {lines.map((line) => (
        <li key={line.who} className="truncate font-mono text-[11px] text-neutral-400">
          <span className="text-orange-300">{line.who}</span> {line.text}
        </li>
      ))}
    </ul>
  );
}
