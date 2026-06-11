import { Icon, tokens } from '../primitives';
import type { Message } from '../../data/mock';
import { useState } from 'react';
import { threadToMarkdown, threadToPdf, download, fileSlug } from '../../lib/export';

// Export 100% client-side: os dados já vivem em messages[]. .md serializa a
// thread; .pdf gera um arquivo real via jspdf (carregado sob demanda), sem o
// diálogo de impressão do navegador.
export function ExportMenu({ title, messages }: { title: string; messages: Message[] }) {
  const [busy, setBusy] = useState(false);
  const exportMd = () => download(`${fileSlug(title)}.md`, 'text/markdown', threadToMarkdown(title, messages));
  const exportPdf = async () => {
    setBusy(true);
    try { await threadToPdf(title, messages); }
    finally { setBusy(false); }
  };
  return (
    <div className="flex items-center gap-0.5">
      <button
        onClick={exportMd}
        disabled={busy}
        title="Baixar conversa em Markdown"
        className={`flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-300 disabled:opacity-50 ${tokens.focusRing}`}
      >
        <Icon name="download" size={13} /> .md
      </button>
      <button
        onClick={exportPdf}
        disabled={busy}
        title="Baixar conversa em PDF"
        className={`flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-300 disabled:opacity-50 ${tokens.focusRing}`}
      >
        <Icon name={busy ? 'rotate' : 'download'} size={13} className={busy ? 'spin' : ''} /> pdf
      </button>
    </div>
  );
}
