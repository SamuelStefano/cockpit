import { type CanvasCard, type CanvasNode, type ContentFormat, cardMarker } from './canvas';

// Prompts the canvas launches. Pure so the kanban, the inspector and the tests
// build the same text; the trailing marker is what binds the session to its card.

export const FORMAT_LABEL: Record<ContentFormat, string> = {
  post: 'post (LinkedIn/Instagram)',
  thread: 'thread (X/Threads)',
  changelog: 'changelog',
  report: 'relatório de progresso',
  reel: 'roteiro de reel',
  daily: 'mensagem de daily',
};

const FORMAT_BRIEF: Record<ContentFormat, string> = {
  post: 'Um post único, gancho na primeira linha, uma ideia central, fecho com pergunta ou CTA. Até 1.300 caracteres.',
  thread: 'Uma thread de 5 a 8 partes, cada parte com até 280 caracteres; a primeira precisa se sustentar sozinha.',
  changelog: 'Changelog agrupado por Adicionado / Corrigido / Mudado, uma linha por item, voltado a quem usa.',
  report: 'Relatório curto: o que andou, o que travou, próximos passos. Números concretos quando existirem.',
  reel: 'Roteiro falado de 30–45s: gancho → evidência → virada → CTA, com as cenas numeradas. Se for conteúdo DFL, siga a skill dfl-reel-engajado antes de escrever.',
  daily: 'Formato: Bom dia / Ontem / Hoje / No blockers — uma linha por item, sem PR nem repo, nada pessoal.',
};

function sourceLines(contexts: CanvasNode[], sessions: CanvasNode[]): string[] {
  const out: string[] = [];
  if (contexts.length) {
    out.push('Contextos (leia cada arquivo antes de agir):');
    for (const c of contexts) out.push(`- ${c.title} — ${c.path ?? `memória \`${c.ref}\``}`);
  }
  if (sessions.length) {
    out.push('Sessões relacionadas (use session-archivist pra puxar detalhe se precisar):');
    for (const s of sessions) out.push(`- ${s.title} (\`${s.ref}\`)${s.subtitle ? ` — ${s.subtitle.slice(0, 160)}` : ''}`);
  }
  return out;
}

export function buildTaskPrompt(card: Pick<CanvasCard, 'id' | 'title' | 'prompt'>, contexts: CanvasNode[], sessions: CanvasNode[]): string {
  return [
    `Tarefa do kanban do Deck: **${card.title}**`,
    '',
    card.prompt.trim() || card.title,
    '',
    ...sourceLines(contexts, sessions),
    '',
    'Ao terminar, atualize a memória do contexto que mudou (leaf ≤2KB) e resuma o que fez em 3 linhas.',
    '',
    cardMarker(card.id),
  ].join('\n');
}

export function buildContentPrompt(
  card: Pick<CanvasCard, 'id' | 'title' | 'prompt'>, format: ContentFormat, contexts: CanvasNode[], sessions: CanvasNode[], date: string,
): string {
  const slug = card.title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'conteudo';
  return [
    `Gerar conteúdo a partir do grafo do Deck: **${card.title}** — formato ${FORMAT_LABEL[format]}.`,
    '',
    FORMAT_BRIEF[format],
    card.prompt.trim() ? `\nBriefing: ${card.prompt.trim()}` : '',
    '',
    ...sourceLines(contexts, sessions),
    '',
    `Escreva o rascunho em \`~/deck-content/${date}-${slug}.md\` e mostre o texto final no chat.`,
    'É RASCUNHO: não publique, não agende e não poste em nenhum sistema. Assunto pessoal nunca vai pro DFL Plans.',
    '',
    cardMarker(card.id),
  ].join('\n');
}
