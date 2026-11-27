import { Button } from '../../components/primitives';
import type { BotFileData } from '../../cockpit/useBotFiles';
import { FilePreviewBody } from './FilePreviewBody';

interface BotFilePreviewProps { path: string; data: BotFileData | undefined; onBack: () => void }

export function BotFilePreview({ path, data, onBack }: BotFilePreviewProps) {
  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" icon="chevronLeft" square aria-label="Voltar pros arquivos" onClick={onBack} />
        <span className="min-w-0 truncate text-[13px] font-medium text-neutral-200" title={path}>{path}</span>
      </div>
      <FilePreviewBody path={path} data={data} />
    </div>
  );
}
