import { Icon, tokens, toast } from '../primitives';
import type { Message } from '../../data/types';
import { useState } from 'react';
import { useShareConversation } from './useShareConversation';
import { threadToMarkdown, threadToPdf, download, fileSlug } from '../../lib/export';

// Export 100% client-side: os dados já vivem em messages[]. .md serializa a
// thread; .pdf gera um arquivo real via jspdf (carregado sob demanda), sem o
// diálogo de impressão do navegador.
export function ExportMenu({ title, messages }: { title: string; messages: Message[] }) {
  const [busy, setBusy] = useState(false);
  const sharing = useShareConversation(title, messages);
  const exportMd = () => download(`${fileSlug(title)}.md`, 'text/markdown', threadToMarkdown(title, messages));
  const exportPdf = async () => {
    setBusy(true);
    // jspdf is a lazy chunk: a failed load or render used to reject silently.
    try { await threadToPdf(title, messages); }
    catch { toast('Não consegui gerar o PDF — tente o .md', { tone: 'error' }); }
    finally { setBusy(false); }
  };
  const row = `flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] text-neutral-100 transition-colors hover:bg-neutral-800 disabled:opacity-50 pointer-coarse:h-11 ${tokens.focusRing}`;
  return (
    <>
      <button onClick={exportMd} disabled={busy} title="Baixar conversa em Markdown" className={row}>
        <Icon name="download" size={14} /> Exportar .md
      </button>
      <button onClick={exportPdf} disabled={busy} title="Baixar conversa em PDF" className={row}>
        <Icon name={busy ? 'rotate' : 'download'} size={14} className={busy ? 'spin' : ''} /> Exportar .pdf
      </button>
      {sharing.enabled && (
        <button onClick={sharing.share} disabled={sharing.busy} title="Criar link público desta conversa" className={row}>
          <Icon name="link" size={14} /> Compartilhar link
        </button>
      )}
      {sharing.enabled && sharing.current && (
        <button onClick={sharing.revoke} disabled={sharing.busy} title="Apagar o link público desta conversa" className={row}>
          <Icon name="trash" size={14} /> Revogar link
        </button>
      )}
    </>
  );
}
