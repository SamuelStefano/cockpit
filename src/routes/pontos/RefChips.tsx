import { Badge } from '../../components/primitives';
import { prUrl } from './pr-link';

// PR refs as compact mono chips; a known repo links to the PR on GitHub.
export function RefChips({ refs }: { refs: string[] }) {
  if (!refs.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {refs.map((r, i) => {
        const href = prUrl(r) ?? undefined;
        return <Badge key={`${i}:${r}`} href={href} title={href ? `Abrir ${r} no GitHub` : r} className="font-mono">{r}</Badge>;
      })}
    </span>
  );
}
