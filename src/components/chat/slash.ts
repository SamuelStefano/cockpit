import type { PermMode } from '../../../shared/protocol';

// Comandos interceptados pelo app (executam local, ver runSlash). O resto da
// lista segue pro Claude como texto — marcamos no palette pra ficar claro.
export const SLASH_HINTS: Record<string, string> = {
  help: 'mostra os atalhos de teclado',
  clear: 'limpa e começa uma sessão nova',
  new: 'começa uma sessão nova',
  'model opus': 'troca esta sessão pro Opus',
  'model sonnet': 'troca esta sessão pro Sonnet',
  'model haiku': 'troca esta sessão pro Haiku',
  plan: 'modo planejar — só descreve, não executa',
  auto: 'modo auto — edita/lê arquivos, sem shell',
  execute: 'modo executar — edita e roda comandos',
  attcontext: 'salva o contexto desta sessão na memória',
  importgpt: 'importa contextos do export do ChatGPT (anexe conversations.json)',
};
export const isLocalSlash = (c: string) => c in SLASH_HINTS;
export const slashHint = (c: string) => SLASH_HINTS[c] ?? 'enviado ao Claude como texto';

const MEMORY_DIR = '/home/samuel/.claude/projects/-home-samuel/memory';

// Prompt do /attcontext: destila o assunto da sessão atual (o claude já tem a
// conversa inteira via --resume) e grava/atualiza um arquivo de memória.
const ATTCONTEXT_PROMPT = `Atualize a memória de contexto com base nesta sessão.

Leia toda a nossa conversa até aqui e destile o CONTEXTO DURÁVEL do assunto desta sessão — o que vale a pena lembrar em conversas futuras: objetivo, decisões firmes, restrições, estado atual e pendências. Ignore detalhes efêmeros (mensagens pontuais, ruído).

Salve em ${MEMORY_DIR}/ como um arquivo markdown com frontmatter (name, description, metadata.type entre user|project|reference|feedback) e adicione/atualize o ponteiro de uma linha em MEMORY.md. Se já existir um arquivo sobre este assunto, ATUALIZE-O em vez de duplicar.

Ao terminar, responda em 2-3 linhas: o que salvou e onde.`;

// Prompt do /importgpt: minera o export do ChatGPT (anexado como conversations.json)
// e propõe contextos duráveis. Pede confirmação antes de gravar em massa.
const IMPORTGPT_PROMPT = `Importe meus contextos do ChatGPT.

Anexei (ou vou anexar) o export do ChatGPT — o arquivo conversations.json. Leia o arquivo anexado; ele pode ser grande, então leia em lotes/offsets se precisar. MINERE os contextos DURÁVEIS sobre MIM e meus projetos: perfil, preferências, decisões, objetivos de vida e de projeto, pessoas e ferramentas recorrentes. Ignore perguntas pontuais e conversa descartável.

Antes de gravar qualquer coisa: leia os arquivos atuais em ${MEMORY_DIR}/ pra não duplicar, e me mostre um RESUMO em lista dos contextos candidatos (título + 1 linha + tipo). Pergunte se pode gravar.

Quando eu confirmar, salve cada contexto como um arquivo markdown em ${MEMORY_DIR}/ com frontmatter (name, description, metadata.type entre user|project|reference|feedback) e adicione o ponteiro em MEMORY.md; ATUALIZE o que já existe em vez de duplicar.

Se eu ainda NÃO tiver anexado o conversations.json, me explique como exportar (ChatGPT → Settings → Data Controls → Export data, chega um .zip por email com o conversations.json) e peça pra anexar.`;

export type SlashAction =
  | { kind: 'help' }
  | { kind: 'new' }
  | { kind: 'model'; model: 'opus' | 'sonnet' | 'haiku' }
  | { kind: 'mode'; mode: 'plan' | 'auto' | 'acceptEdits' }
  | { kind: 'prompt'; text: string; mode?: PermMode }
  | null;

// Decisão PURA de qual ação app-side um slash dispara (ou null = passa pro
// Claude como texto). runSlash só despacha os efeitos colaterais a partir disto.
export function classifySlash(raw: string): SlashAction {
  const m = raw.match(/^\/(\S+)\s*(.*)$/);
  if (!m) return null;
  const cmd = m[1].toLowerCase();
  const arg = m[2].trim().toLowerCase();
  if (cmd === 'help') return { kind: 'help' };
  if (cmd === 'clear' || cmd === 'new') return { kind: 'new' };
  if (cmd === 'model' && (arg === 'opus' || arg === 'sonnet' || arg === 'haiku')) return { kind: 'model', model: arg };
  if (cmd === 'plan') return { kind: 'mode', mode: 'plan' };
  if (cmd === 'auto') return { kind: 'mode', mode: 'auto' };
  if (cmd === 'execute') return { kind: 'mode', mode: 'acceptEdits' };
  // Comandos que expandem num prompt elaborado e rodam em modo 'auto' (lê/grava
  // arquivos de memória, sem shell). O onSend recebe modeOverride='auto'.
  if (cmd === 'attcontext') return { kind: 'prompt', text: ATTCONTEXT_PROMPT, mode: 'auto' };
  if (cmd === 'importgpt') return { kind: 'prompt', text: IMPORTGPT_PROMPT, mode: 'auto' };
  return null;
}
