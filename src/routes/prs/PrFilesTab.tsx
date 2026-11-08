import type { PrDetail } from '../../../shared/prs';

const CHANGE: Record<PrDetail['files'][number]['change'], string> = { added: 'novo', deleted: 'removido', modified: 'editado', renamed: 'renomeado' };

export function PrFilesTab({ detail }: { detail: PrDetail }) {
  return (
    <div className="space-y-2">
      <ul className="divide-y divide-neutral-800/80 rounded-xl border border-neutral-800">
        {detail.files.map((f) => (
          <li key={f.path} className="flex items-center gap-2 px-3 py-2">
            <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-neutral-200" title={f.path}>{f.path}</span>
            <span className="shrink-0 text-[12px] text-neutral-500">{CHANGE[f.change]}</span>
            <span className="shrink-0 font-mono text-[12px]"><span className="text-green-400">+{f.additions}</span> <span className="text-red-400">−{f.deletions}</span></span>
          </li>
        ))}
      </ul>
      {detail.filesTruncated && <p className="text-[12px] text-yellow-400">Lista parcial: a PR tem mais arquivos ({detail.changedFiles}) do que o exibido.</p>}
    </div>
  );
}
