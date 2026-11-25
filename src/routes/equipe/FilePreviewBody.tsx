import { Markdown, Skeleton } from '../../components/primitives';
import type { BotFileData } from '../../cockpit/useBotFiles';
import { fileKind, formatSize } from './file-groups';
import { NumberedText } from './NumberedText';

interface FilePreviewBodyProps {
  path: string;
  data: BotFileData | undefined;
  // Line-number gutter on text (the chat's read-only file panel).
  numbered?: boolean;
  // Line to land on; a markdown file then shows its source, where lines exist.
  line?: number;
}

export function FilePreviewBody({ path, data, numbered = false, line }: FilePreviewBodyProps) {
  const kind = fileKind(path);
  if (!data || data.status === 'loading') return <Skeleton className="h-40 w-full rounded-xl" />;
  if (data.status === 'error') return <p className="px-1 text-[13px] text-red-400/90">{data.error}</p>;
  // Decided by what the server sent, not by the name: an svg arrives as an image, a Makefile as text.
  if (data.mime.startsWith('image/')) return <img src={data.url} alt={path} className="max-h-[60vh] w-full rounded-xl border border-neutral-800 bg-white/5 object-contain" />;
  if (data.text === undefined) return <p className="px-1 text-[13px] text-neutral-500">Sem prévia pra este tipo de arquivo ({formatSize(data.size)}).</p>;
  if (data.text === '') return <p className="px-1 text-[13px] text-neutral-500">Arquivo vazio.</p>;
  return (
    <>
      {kind === 'markdown' && !line ? <div className="rounded-xl border border-neutral-800 p-3 text-[13px]"><Markdown md={data.text} /></div>
        : numbered ? <NumberedText text={data.text} line={line} />
        : <pre className="scroll-thin max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-xl border border-neutral-800 p-3 text-[13px] leading-relaxed text-neutral-300">{data.text}</pre>}
      {data.truncated && <p className="px-1 pt-2 text-[12px] text-neutral-500">Arquivo grande ({formatSize(data.size)}): só o começo aparece aqui.</p>}
    </>
  );
}
