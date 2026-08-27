import type { ContextMeta, SessionMeta, SkillMeta } from '../../shared/protocol';

// Catálogo e formatação da superfície MCP. Separado de tools.ts (que toca disco e
// SQLite) pra continuar puro e testável sem fixture nem banco.

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required?: string[];
  };
}

export const SESSIONS_DEFAULT = 30;
export const SESSIONS_MAX = 200;
export const TRANSCRIPT_DEFAULT = 12_000;
export const TRANSCRIPT_MAX = 60_000;

export const MCP_TOOLS: ToolDef[] = [
  {
    name: 'contexts_list',
    description:
      'Lista as memórias curadas do agente (markdown tipado do memoryDir): id, tipo, título e descrição. Comece por aqui para saber que contexto existe.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'contexts_read',
    description: 'Lê uma memória curada inteira pelo id devolvido por contexts_list.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Slug do contexto, ex: handoff-20260826-a1b2c3d4' } },
      required: ['id'],
    },
  },
  {
    name: 'sessions_list',
    description: 'Lista as sessões recentes do Claude CLI (mais nova primeiro) com título, resumo e quantidade de mensagens.',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'number', description: `Quantas sessões devolver (1..${SESSIONS_MAX}, padrão ${SESSIONS_DEFAULT})` } },
    },
  },
  {
    name: 'sessions_search',
    description:
      'Busca por conteúdo em todas as sessões e devolve as que casam, com o trecho que bateu. Use para achar uma conversa antiga sobre um assunto.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Termo literal, de 2 a 200 caracteres' } },
      required: ['query'],
    },
  },
  {
    name: 'sessions_read',
    description: 'Lê a transcrição de uma sessão (caminho ativo da conversa, sem saída de ferramenta), cortada na cauda mais recente.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'UUID da sessão' },
        chars: { type: 'number', description: `Teto de caracteres da transcrição (padrão ${TRANSCRIPT_DEFAULT}, máx ${TRANSCRIPT_MAX})` },
      },
      required: ['id'],
    },
  },
  {
    name: 'skills_list',
    description: 'Lista as skills do agente (diretórios com SKILL.md).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'skills_read',
    description: 'Lê o SKILL.md completo de uma skill pelo id.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Slug da skill' } },
      required: ['id'],
    },
  },
];

// Um cliente MCP manda o que quiser em `arguments`: number pode chegar string,
// ausente ou NaN. Prende no intervalo em vez de confiar, senão um `limit` bobo
// vira payload gigante do outro lado. Só number e string numérica entram no
// Number(): `null`, `[]`, `''` e `false` viram 0 na coerção, e 0 é finito — cairiam
// no clamp e virariam `min` em vez do default, que é o que "não informado" quer.
export function clampNumber(v: unknown, def: number, max: number, min = 1): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return def;
  return Math.min(Math.max(Math.floor(n), min), max);
}

export function formatContexts(metas: ContextMeta[]): string {
  if (metas.length === 0) return 'Nenhum contexto no memoryDir.';
  return metas
    .map((m) => `- ${m.id} [${m.type}] ${m.title}${m.description ? ` — ${m.description}` : ''}`)
    .join('\n');
}

export function formatSessions(metas: SessionMeta[]): string {
  if (metas.length === 0) return 'Nenhuma sessão.';
  return metas
    .map((m) => {
      const head = `- ${m.id} — ${m.title} (${m.relative}, ${m.count} msgs)`;
      const resumo = m.summary ? `\n  resumo: ${m.summary}` : '';
      const trecho = m.snippet ? `\n  trecho: ${m.snippet}` : '';
      return head + resumo + trecho;
    })
    .join('\n');
}

export function formatSkills(metas: SkillMeta[]): string {
  if (metas.length === 0) return 'Nenhuma skill.';
  return metas.map((m) => `- ${m.id} — ${m.name}${m.description ? `: ${m.description}` : ''}`).join('\n');
}
