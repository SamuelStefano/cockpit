import { Button } from '../../primitives';
import type { SessionFileData } from '../../../cockpit/useSessionFiles';
import { FilePreviewBody } from '../../../routes/equipe/BotFilePreview';
import { formatSize } from '../../../routes/equipe/file-groups';

interface ChatFilePanelProps {
  path: string;
  data: SessionFileData | undefined;
  onClose: () => void;
  // Phones get a full-screen sheet; desktop a column beside the chat.
  fullScreen: boolean;
}

export function ChatFilePanel({ path, data, onClose, fullScreen }: ChatFilePanelProps) {
  const box = fullScreen
    ? 'fixed inset-0 z-50 bg-[var(--bg-deep)]'
    : 'relative w-[min(520px,45%)] shrink-0 border-l border-neutral-800 bg-[var(--bg-deep)]';
  return (
    <aside role="complementary" aria-label="Arquivo" className={`flex min-h-0 min-w-0 flex-col ${box}`}>
      <div className="flex items-center gap-1 border-b border-neutral-800 px-3 py-2">
        <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-neutral-200" title={path}>{path}</span>
        {data?.status === 'ok' && <span className="shrink-0 text-[12px] text-neutral-500">{formatSize(data.size)}</span>}
        <Button variant="ghost" size="sm" icon="x" square aria-label="Fechar arquivo" onClick={onClose} />
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3">
        <FilePreviewBody path={path} data={data} numbered />
      </div>
      <div className="border-t border-neutral-800 px-3 py-1.5 text-[12px] text-neutral-500">Somente leitura</div>
    </aside>
  );
}
