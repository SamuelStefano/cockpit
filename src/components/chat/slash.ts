import type { EffortLevel } from '../../../shared/protocol';

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
  'effort low': 'esforço de raciocínio baixo',
  'effort medium': 'esforço de raciocínio médio',
  'effort high': 'esforço de raciocínio alto',
  'effort xhigh': 'esforço de raciocínio extra-alto',
  'effort max': 'esforço de raciocínio máximo',
};
const EFFORT_BY_SLASH: Record<string, EffortLevel> = {
  low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', max: 'max',
};
export const isLocalSlash = (c: string) => c in SLASH_HINTS;
export const slashHint = (c: string) => SLASH_HINTS[c] ?? 'enviado ao Claude como texto';

export type SlashAction =
  | { kind: 'help' }
  | { kind: 'new' }
  | { kind: 'model'; model: 'opus' | 'sonnet' | 'haiku' }
  | { kind: 'mode'; mode: 'plan' | 'auto' | 'acceptEdits' }
  | { kind: 'effort'; effort: EffortLevel }
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
  if (cmd === 'effort' && arg in EFFORT_BY_SLASH) return { kind: 'effort', effort: EFFORT_BY_SLASH[arg] };
  return null;
}
