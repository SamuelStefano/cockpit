import { Icon, tokens, toast } from '../primitives';
import type { Message } from '../../data/types';
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
    // jspdf is a lazy chunk: a failed load or render used to reject silently.
    try { await threadToPdf(title, messages); }
    catch { toast('Não consegui gerar o PDF — tente o .md', { tone: 'error' }); }
    finally { setBusy(false); }
  };
  const row = `flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-neutral-300 transition hover:bg-neutral-800/60 hover:text-neutral-100 disabled:opacity-50 pointer-coarse:min-h-11 ${tokens.focusRing}`;
  return (
    <>
      <button onClick={exportMd} disabled={busy} title="Baixar conversa em Markdown" className={row}>
        <Icon name="download" size={13} /> Exportar .md
      </button>
      <button onClick={exportPdf} disabled={busy} title="Baixar conversa em PDF" className={row}>
        <Icon name={busy ? 'rotate' : 'download'} size={13} className={busy ? 'spin' : ''} /> Exportar pdf
      </button>
    </>
  );
}
