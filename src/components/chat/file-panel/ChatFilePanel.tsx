import { Button } from '../../primitives';
import type { SessionFileData } from '../../../cockpit/useSessionFiles';
import { useCopied } from '../../../lib/useCopied';
import { FilePreviewBody } from '../../../routes/equipe/FilePreviewBody';
import { formatSize } from '../../../routes/equipe/file-groups';
import { useFilePanelDismiss } from './useFilePanelDismiss';

interface ChatFilePanelProps {
  path: string;
  line?: number;
  // Changes on every open, also of the same file: focus and scroll follow it.
  openKey: string;
  data: SessionFileData | undefined;
  onClose: () => void;
  // Phones get a full-screen sheet; desktop a column beside the chat.
  fullScreen: boolean;
}

export function ChatFilePanel({ path, line, openKey, data, onClose, fullScreen }: ChatFilePanelProps) {
  const { ref, onKeyDown } = useFilePanelDismiss(fullScreen, onClose, openKey);
  const [copied, copy] = useCopied();
  const name = path.split('/').pop() || path;
  const body = (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3">
      <FilePreviewBody key={openKey} path={path} data={data} numbered line={line} />
    </div>
  );
  if (fullScreen) {
    return (
      <aside ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`Arquivo ${name}`} className="fixed inset-0 z-50 flex min-h-0 flex-col bg-[var(--bg-deep)] pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] outline-hidden">
        <div className="flex items-center gap-1 border-b border-neutral-800 px-2 py-1.5">
          <Button variant="ghost" size="sm" icon="chevronLeft" square aria-label="Voltar pro chat" onClick={onClose} />
          <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-neutral-200">{name}</span>
        </div>
        {body}
      </aside>
    );
  }
  return (
    <aside ref={ref} tabIndex={-1} onKeyDown={onKeyDown} role="complementary" aria-label={`Arquivo ${name}`} className="relative flex min-h-0 w-[min(500px,45%)] min-w-0 shrink-0 flex-col border-l border-(--border) bg-neutral-950 outline-hidden">
      <div className="flex h-[52px] shrink-0 items-center gap-1 border-b border-(--border) pl-4 pr-3">
        <span className="min-w-0 flex-1 truncate font-mono text-[13px] font-medium text-neutral-100" title={path}>{name}</span>
        <Button variant="ghost" size="xs" icon={copied ? 'check' : 'copy'} square aria-label="Copiar caminho" title="Copiar caminho" onClick={() => copy(path)} />
        <Button variant="ghost" size="xs" icon="x" square aria-label="Fechar arquivo" title="Fechar (Esc)" onClick={onClose} />
      </div>
      {body}
      <div className="flex items-center gap-2 border-t border-(--border) px-4 py-2.5 text-[12px] text-(--text-muted)">
        <span className="shrink-0">Somente leitura</span>
        <span className="min-w-0 flex-1 truncate text-right font-mono text-neutral-600" title={path}>{path}</span>
        {data?.status === 'ok' && <span className="shrink-0">{formatSize(data.size)}</span>}
      </div>
    </aside>
  );
}
