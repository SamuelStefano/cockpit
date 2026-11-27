import { Button } from '../../components/primitives';
import type { BotFile } from '../../../shared/protocol';
import { formatSize } from '../equipe/file-groups';

interface SettingsGroupProps {
  files: BotFile[];
  openPath: string | null;
  editable: boolean;
  onPick: (path: string) => void;
  onCreate: () => void;
}

export function SettingsGroup({ files, openPath, editable, onPick, onCreate }: SettingsGroupProps) {
  const hasMain = files.some((f) => f.path === '.claude/settings.json');
  if (!files.length && !editable) return null;
  return (
    <section aria-label=".claude" className="flex flex-col gap-0.5">
      <h3 className="flex min-h-7.5 items-center px-2.5 font-mono text-[12.5px] font-normal text-(--text-weak)">.claude/</h3>
      {files.map((f) => {
        const on = f.path === openPath;
        return (
          <button key={f.path} type="button" aria-current={on || undefined} onClick={() => onPick(f.path)} title={f.path}
            className={`flex min-h-8.5 w-full items-center gap-2 rounded-lg px-2.5 pl-7 text-left font-mono text-[12.5px] transition ${on ? 'bg-(--accent-tint) text-(--accent-soft)' : 'text-(--text-body) hover:bg-neutral-800'}`}>
            <span className="min-w-0 flex-1 truncate">{f.path.slice(f.path.lastIndexOf('/') + 1)}</span>
            <span className="shrink-0 text-[11px] text-(--text-muted)">{formatSize(f.size)}</span>
          </button>
        );
      })}
      {editable && !hasMain && <div className="pl-5"><Button variant="ghost" size="xs" icon="plus" onClick={onCreate}>Criar settings.json</Button></div>}
    </section>
  );
}
