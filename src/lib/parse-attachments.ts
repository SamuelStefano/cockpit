// Os anexos vão no wire como linhas `[anexo: <path>]` antes do texto (useCockpit).
// Aqui separamos esses marcadores do corpo pra bolha do usuário poder mostrar os
// anexos como chips em vez de deixar o path cru no meio da conversa.
export interface ParsedAttachment {
  path: string;
  name: string;
}

const ANEXO_RE = /^\[anexo:\s*(.+?)\]$/;
// Texto extraído de um anexo binário (ex.: .docx) viaja inline no wire entre estes
// marcadores, pra o agente ter o conteúdo sem depender do Read. A bolha descarta o
// bloco inteiro — só o chip do anexo aparece.
const TEXT_OPEN_RE = /^\[anexo-texto(?::.*)?\]$/;
const TEXT_CLOSE = '[/anexo-texto]';

// Embute o texto extraído logo após o ref do anexo. Mantido aqui pra ficar ao lado
// do parser que o remove — os dois formatos não podem divergir.
export function attachmentTextBlock(name: string, text: string): string {
  return `[anexo-texto: ${name}]\n${text}\n${TEXT_CLOSE}`;
}

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
  let skipping = false;
  for (const line of text.split('\n')) {
    if (skipping) { if (line === TEXT_CLOSE) skipping = false; continue; }
    if (TEXT_OPEN_RE.test(line)) { skipping = true; continue; }
    const m = line.match(ANEXO_RE);
    if (m) attachments.push({ path: m[1], name: baseName(m[1]) });
    else rest.push(line);
  }
  return { attachments, body: rest.join('\n').trim() };
}
