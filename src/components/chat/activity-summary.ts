import type { ToolCall } from '../../data/types';
import type { IconName } from '../primitives/Icon';

type Kind = 'read' | 'search' | 'run' | 'edit' | 'web' | 'mcp' | 'agent' | 'todo' | 'other';

const KIND_BY_NAME: Record<string, Kind> = {
  Read: 'read', NotebookRead: 'read',
  Grep: 'search', Glob: 'search', LS: 'search',
  Bash: 'run', BashOutput: 'run',
  Edit: 'edit', MultiEdit: 'edit', Write: 'edit', NotebookEdit: 'edit',
  WebFetch: 'web', WebSearch: 'web',
  Agent: 'agent', Task: 'agent',
  TodoWrite: 'todo',
};

const KIND_ICON: Record<Kind, IconName> = {
  read: 'file', search: 'search', run: 'terminal', edit: 'pencil', web: 'link',
  mcp: 'layers', agent: 'users', todo: 'clipboard', other: 'wrench',
};

export function toolKind(t: Pick<ToolCall, 'name'>): Kind {
  if (t.name.startsWith('mcp__')) return 'mcp';
  return KIND_BY_NAME[t.name] ?? 'other';
}

export function mcpServer(name: string): string {
  return name.split('__')[1] ?? name;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

interface Counts { kinds: Map<Kind, number>; servers: string[] }

function count(tools: ToolCall[]): Counts {
  const kinds = new Map<Kind, number>();
  const servers: string[] = [];
  for (const t of tools) {
    const k = toolKind(t);
    kinds.set(k, (kinds.get(k) ?? 0) + 1);
    if (k === 'mcp') {
      const s = mcpServer(t.name);
      if (!servers.includes(s)) servers.push(s);
    }
  }
  return { kinds, servers };
}

const ORDER: Kind[] = ['read', 'search', 'web', 'mcp', 'run', 'edit', 'agent', 'todo', 'other'];

export function activityIcons(tools: ToolCall[]): IconName[] {
  const { kinds } = count(tools);
  return ORDER.filter((k) => kinds.has(k)).slice(0, 3).map((k) => KIND_ICON[k]);
}

function joinParts(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`;
}

function donePart(k: Kind, n: number, servers: string[]): string {
  switch (k) {
    case 'read': return `leu ${plural(n, 'arquivo', 'arquivos')}`;
    case 'search': return n === 1 ? 'buscou no código' : `buscou ${n} vezes no código`;
    case 'web': return 'pesquisou na web';
    case 'mcp': return `consultou ${servers.length === 1 ? 'o ' : 'os '}${servers.slice(0, 2).join(' e ')}${servers.length > 2 ? ` e +${servers.length - 2}` : ''}`;
    case 'run': return `rodou ${plural(n, 'comando', 'comandos')}`;
    case 'edit': return `alterou ${plural(n, 'arquivo', 'arquivos')}`;
    case 'agent': return `delegou ${plural(n, 'tarefa', 'tarefas')}`;
    case 'todo': return 'atualizou a lista de tarefas';
    default: return `usou ${plural(n, 'ferramenta', 'ferramentas')}`;
  }
}

function livePart(k: Kind, n: number, servers: string[]): string {
  switch (k) {
    case 'read': return plural(n, 'arquivo lido', 'arquivos lidos');
    case 'search': return plural(n, 'busca', 'buscas');
    case 'web': return plural(n, 'pesquisa na web', 'pesquisas na web');
    case 'mcp': return `consultando ${servers.slice(0, 2).join(' e ')}`;
    case 'run': return plural(n, 'comando', 'comandos');
    case 'edit': return plural(n, 'arquivo alterado', 'arquivos alterados');
    case 'agent': return plural(n, 'tarefa delegada', 'tarefas delegadas');
    case 'todo': return 'lista de tarefas';
    default: return plural(n, 'ferramenta', 'ferramentas');
  }
}

export function activityPhrase(tools: ToolCall[]): string {
  const { kinds, servers } = count(tools);
  const running = tools.some((t) => t.status === 'running');
  const present = ORDER.filter((k) => kinds.has(k));
  if (running) {
    const parts = present.slice(0, 3).map((k) => livePart(k, kinds.get(k)!, servers));
    return `Rodando · ${parts.join(', ')}${present.length > 3 ? `, +${present.length - 3}` : ''}`;
  }
  const parts = present.slice(0, 3).map((k) => donePart(k, kinds.get(k)!, servers));
  const text = present.length > 3 ? `${parts.join(', ')} e mais ${present.length - 3}` : joinParts(parts);
  return text.charAt(0).toUpperCase() + text.slice(1);
}
