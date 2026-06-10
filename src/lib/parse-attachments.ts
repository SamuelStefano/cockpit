// Os anexos vão no wire como linhas `[anexo: <path>]` antes do texto (useCockpit).
// Aqui separamos esses marcadores do corpo pra bolha do usuário poder mostrar os
// anexos como chips em vez de deixar o path cru no meio da conversa.
export interface ParsedAttachment {
  path: string;
  name: string;
}

const ANEXO_RE = /^\[anexo:\s*(.+?)\]$/;

// O servidor salva como `<ts base36>-<4 bytes hex>-<nome-original>`; mostramos o
// nome original pro usuário reconhecer o arquivo. O ts é base36 (começa com
// letra!), então o prefixo é [a-z0-9]+, não \d+ — a regex antiga nunca casava.
function baseName(p: string): string {
  const seg = p.split('/').pop() ?? p;
  return seg.replace(/^[a-z0-9]+-[a-z0-9]+-/i, '');
}

export function parseAttachments(text: string): { attachments: ParsedAttachment[]; body: string } {
  const attachments: ParsedAttachment[] = [];
  const rest: string[] = [];
  for (const line of text.split('\n')) {
    const m = line.match(ANEXO_RE);
    if (m) attachments.push({ path: m[1], name: baseName(m[1]) });
    else rest.push(line);
  }
  return { attachments, body: rest.join('\n').trim() };
}
