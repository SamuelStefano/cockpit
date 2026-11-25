import { Button, Markdown, Skeleton } from '../../components/primitives';
import type { BotFileData } from '../../cockpit/useBotFiles';
import { fileKind, formatSize } from './file-groups';

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

// Shared with the chat's read-only file panel; `numbered` adds a line-number gutter to text.
export function FilePreviewBody({ path, data, numbered = false }: { path: string; data: BotFileData | undefined; numbered?: boolean }) {
  const kind = fileKind(path);
  return (
    <>
      {!data || data.status === 'loading' ? <Skeleton className="h-40 w-full rounded-xl" />
        : data.status === 'error' ? <p className="px-1 text-[13px] text-red-400/90">{data.error}</p>
        : kind === 'image' ? <img src={data.url} alt={path} className="max-h-[60vh] w-full rounded-xl border border-neutral-800 bg-white/5 object-contain" />
        : kind === 'markdown' && data.text !== undefined ? <div className="rounded-xl border border-neutral-800 p-3 text-[13px]"><Markdown md={data.text} /></div>
        : data.text !== undefined && numbered ? <NumberedText text={data.text} />
        : data.text !== undefined ? <pre className="scroll-thin max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-xl border border-neutral-800 p-3 text-[13px] leading-relaxed text-neutral-300">{data.text}</pre>
        : <p className="px-1 text-[13px] text-neutral-500">Sem prévia pra este tipo de arquivo ({formatSize(data.size)}).</p>}
    </>
  );
}

function NumberedText({ text }: { text: string }) {
  const lines = text.replace(/\n$/, '').split('\n');
  return (
    <div className="scroll-thin overflow-auto rounded-xl border border-neutral-800 py-2 font-mono text-[12px] leading-relaxed text-neutral-300">
      <table className="w-full border-collapse"><tbody>
        {lines.map((l, i) => (
          <tr key={i}>
            <td className="select-none whitespace-nowrap pl-3 pr-3 text-right align-top text-neutral-600">{i + 1}</td>
            <td className="whitespace-pre-wrap break-all pr-3">{l}</td>
          </tr>
        ))}
      </tbody></table>
    </div>
  );
}
