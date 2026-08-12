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

// Codifica os anexos no wire (linhas `[anexo:]` + bloco de texto extraído) antes do
// corpo. Fonte única do formato — onSend e a fila (queueAdd) usam a MESMA função pra
// o anexo ficar amarrado ao prompt certo, não vazar pro próximo envio. Inverso de
// parseAttachments.
export function encodeAttachments(atts: { path: string; name: string; text?: string }[], text: string): string {
  if (!atts.length) return text;
  const head = atts
    .map((a) => (a.text ? `[anexo: ${a.path}]\n${attachmentTextBlock(a.name, a.text)}` : `[anexo: ${a.path}]`))
    .join('\n');
  return `${head}\n\n${text}`;
}

// Troca só o corpo do wire, preservando os marcadores de anexo. Editar um item da
// fila edita o texto que o usuário vê (o corpo limpo do parseAttachments); sem isto
// a reescrita apagaria os anexos já amarrados àquele prompt.
export function replaceBody(raw: string, body: string): string {
  const head: string[] = [];
  let openAt = -1;
  for (const line of raw.split('\n')) {
    if (openAt >= 0) { head.push(line); if (line === TEXT_CLOSE) openAt = -1; continue; }
    if (TEXT_OPEN_RE.test(line)) { openAt = head.length; head.push(line); continue; }
    if (ANEXO_RE.test(line)) head.push(line);
  }
  // Bloco sem fechamento engoliria o corpo antigo pro head e o reescrever passaria a
  // empilhar corpo a cada edição — descarta o bloco truncado, como o parseAttachments.
  if (openAt >= 0) head.length = openAt;
  return head.length ? `${head.join('\n')}\n\n${body}` : body;
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
