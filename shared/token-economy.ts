// Catálogo de economia de contexto. Fica em shared/ porque três consumidores leem o
// MESMO dado: a doc (/docs), o futuro botão de verificação de harness, e o agente do
// usuário via MCP. Duplicar isso em prosa faria a doc e a checagem divergirem na
// primeira alteração.

export interface Lever { name: string; gain: string }

export const LEVERS: readonly Lever[] = [
  { name: 'Effort High → Medium', gain: '~45% menos tokens, sem perda de qualidade' },
  { name: 'Índice de memória vira roteador', gain: '~5k tokens por injeção, em toda mensagem' },
  { name: 'Sessão nova a 50% da janela', gain: 'corta o crescimento do histórico antes de doer' },
  { name: 'Prompt específico + arquivo citado', gain: 'evita o agente abrir 5 arquivos procurando' },
  { name: 'Plan mode antes de executar', gain: 'mata o custo de trial-and-error' },
  { name: 'Prompt caching (API)', gain: '90% de desconto no prefixo estático' },
] as const;

export interface HarnessCheck {
  id: string;
  title: string;
  why: string;
  // Comando que RESPONDE a pergunta lendo arquivo. O agente roda e reporta o número —
  // sem isso a auditoria vira opinião, e opinião não mede economia.
  probe: string;
}

export const HARNESS_CHECKS: readonly HarnessCheck[] = [
  {
    id: 'index-size',
    title: 'O índice de memória é roteador ou catálogo?',
    why: 'Catálogo custa O(n) fixo: cada memória nova encarece toda mensagem, pra sempre.',
    probe: 'wc -c ~/.claude/projects/*/memory/MEMORY.md',
  },
  {
    id: 'oversized-memories',
    title: 'Existe memória grande demais?',
    why: 'Acima de ~4KB um único recall custa mais que a tarefa que o pediu.',
    probe: 'find ~/.claude/projects/*/memory -name "*.md" -size +4k',
  },
  {
    id: 'orphan-memories',
    title: 'Existe memória órfã?',
    why: 'Não indexada e não linkada por ninguém = peso morto que nunca é recuperado.',
    probe: 'ls ~/.claude/projects/*/memory/*.md | wc -l',
  },
  {
    id: 'claude-md-bloat',
    title: 'O CLAUDE.md tem detalhe de projeto inline?',
    why: 'Ele carrega sempre. Detalhe de um projeto só interessa em tarefas daquele projeto — vira ponteiro.',
    probe: 'wc -c ~/.claude/CLAUDE.md ./CLAUDE.md',
  },
  {
    id: 'effort-default',
    title: 'O effort default está em High sem necessidade?',
    why: 'É a maior alavanca isolada: ~45% de queda sem perda medida de qualidade.',
    probe: 'grep -r effort ~/.claude/settings.json',
  },
  {
    id: 'session-bloat',
    title: 'Há sessão gigante ainda ativa na lista?',
    why: 'Transcript grande custa a cada retomada e ainda pressiona o disco.',
    probe: 'du -sh ~/.claude/projects/*/ | sort -h | tail -5',
  },
  {
    id: 'tool-output',
    title: 'Output de tool entra cru no contexto?',
    why: 'Um comando verboso pode custar mais que a resposta inteira. Filtrar na origem é mais barato que resumir depois.',
    probe: 'echo "revisar hooks e comandos que despejam saída longa"',
  },
] as const;
