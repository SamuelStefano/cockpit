import type { Connection, ConnectionKind, ConnectionState } from '../../../shared/connections';
import type { TeamBot } from '../../../shared/protocol';

export type ConnTab = 'provedores' | 'ferramentas' | 'maquinas' | 'aparelhos' | 'chaves';

export const TAB_KIND: Record<ConnTab, ConnectionKind> = {
  provedores: 'provider', ferramentas: 'tool', maquinas: 'machine', aparelhos: 'device', chaves: 'key',
};

export const TAB_LABEL: Record<ConnTab, string> = {
  provedores: 'Provedores', ferramentas: 'Ferramentas', maquinas: 'Máquinas', aparelhos: 'Aparelhos', chaves: 'Chaves',
};

export const TAB_HEAD: Record<ConnTab, [string, string, string, string]> = {
  provedores: ['Provedor', 'Estado', 'Último uso', 'Usado por'],
  ferramentas: ['Ferramenta', 'Estado', 'Último uso', 'Usada por'],
  maquinas: ['Máquina', 'Estado', 'Visto', 'Agentes'],
  aparelhos: ['Aparelho', 'Estado', 'Visto', ''],
  chaves: ['Chave', 'Estado', 'Último uso', 'Usada por'],
};

export const EMPTY_COPY: Record<ConnTab, { title: string; text: string }> = {
  provedores: { title: 'Nenhum provedor ainda', text: 'Um provedor é quem responde pelos agentes: Claude, OpenAI, Gemini, um modelo local… Conecte um e a equipe começa a falar.' },
  ferramentas: { title: 'Nenhuma ferramenta ainda', text: 'Ferramentas deixam os agentes ler e escrever em outros serviços: tarefas, e-mail, arquivos. Conecte uma para começar.' },
  maquinas: { title: 'Nenhuma máquina ainda', text: 'Cada máquina com o Deck instalado aparece aqui, com os agentes que rodam nela.' },
  aparelhos: { title: 'Nenhum aparelho ainda', text: 'Celulares e computadores que entram na sua conta aparecem aqui. Você pode remover quando quiser.' },
  chaves: { title: 'Nenhuma chave ainda', text: 'Chaves guardadas ficam criptografadas e nunca voltam a aparecer inteiras.' },
};

export function visibleTabs(items: Connection[]): ConnTab[] {
  const all = Object.keys(TAB_KIND) as ConnTab[];
  return all.filter((t) => t !== 'chaves' || items.some((i) => i.kind === 'key'));
}

export function itemsOf(items: Connection[], tab: ConnTab): Connection[] {
  return items.filter((i) => i.kind === TAB_KIND[tab]);
}

export function tabOfKind(kind: ConnectionKind): ConnTab {
  return (Object.keys(TAB_KIND) as ConnTab[]).find((t) => TAB_KIND[t] === kind) ?? 'provedores';
}

export function stateLabel(c: Pick<Connection, 'kind' | 'state'>): string {
  switch (c.state) {
    case 'connected': return c.kind === 'machine' ? 'ligada' : 'conectado';
    case 'expired': return c.kind === 'tool' ? 'falta entrar' : 'expirou';
    case 'error': return 'erro';
    default: return c.kind === 'machine' ? 'desligada' : c.kind === 'device' ? 'desconectado' : 'desligado';
  }
}

export const STATE_TONE: Record<ConnectionState, string> = {
  connected: 'text-emerald-400',
  expired: 'text-amber-300',
  error: 'text-red-400',
  off: 'text-neutral-500',
};

export const STATE_DOT: Record<ConnectionState, string> = {
  connected: 'bg-emerald-400',
  expired: 'bg-amber-300',
  error: 'bg-red-400',
  off: 'bg-neutral-600',
};

export function needsYou(c: Connection): boolean {
  return c.state === 'expired' || c.state === 'error';
}

export function problems(items: Connection[]): Connection[] {
  return items.filter(needsYou);
}

function join(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`;
}

export function noticeOf(items: Connection[], bots: TeamBot[]): { title: string; body: string; short: string } | null {
  const bad = problems(items);
  if (!bad.length) return null;
  const title = bad.length === 1 ? '1 conexão precisa de você.' : `${bad.length} conexões precisam de você.`;
  const what = join(bad.map((c) => (c.state === 'expired' ? (c.kind === 'tool' ? `falta entrar em ${c.label}` : `${c.label} expirou`) : `${c.label} deu erro`)));
  const ids = new Set(bad.flatMap((c) => c.usedBy ?? []));
  const names = bots.filter((b) => ids.has(b.id)).map((b) => b.name);
  const tail = names.length
    ? ` — ${join(names)} ${names.length === 1 ? 'não consegue' : 'não conseguem'} usar isso até você resolver.`
    : '.';
  return { title, body: `${what}${tail}`, short: bad.map((c) => c.label).join(', ') };
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export function lastUsedLabel(ts: number | undefined, now: number): string {
  if (!ts || !Number.isFinite(ts)) return '—';
  const d = now - ts;
  if (d < 10_000) return 'agora';
  if (d < MIN) return `há ${Math.floor(d / 1000)} s`;
  if (d < HOUR) return `há ${Math.floor(d / MIN)} min`;
  if (d < DAY) return `há ${Math.floor(d / HOUR)} h`;
  if (d < 2 * DAY) return 'ontem';
  if (d < 7 * DAY) return `há ${Math.floor(d / DAY)} dias`;
  return new Date(ts).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '');
}

export type RowAction = { kind: 'relogin' | 'error' | 'turnon' | 'remove'; label: string; primary: boolean };

export function actionOf(c: Connection): RowAction | null {
  if (c.kind === 'device') return { kind: 'remove', label: 'Remover', primary: false };
  if (c.kind !== 'provider' && c.kind !== 'tool') return null;
  if (c.state === 'expired') return { kind: 'relogin', label: c.kind === 'tool' ? 'Entrar' : 'Entrar de novo', primary: true };
  if (c.state === 'error') return { kind: 'error', label: 'Ver erro', primary: false };
  if (c.state === 'off') return { kind: 'turnon', label: 'Ligar', primary: false };
  return null;
}

const LOGO_TONES = [
  'bg-orange-950 text-orange-300', 'bg-emerald-950 text-emerald-300', 'bg-indigo-950 text-indigo-300',
  'bg-sky-950 text-sky-300', 'bg-rose-950 text-rose-300', 'bg-purple-950 text-purple-300',
];

export function logoOf(label: string): { text: string; tone: string } {
  const clean = label.replace(/^dfl-/i, '').trim() || label;
  const text = (label.toLowerCase().startsWith('dfl-') ? 'DF' : clean.slice(0, 1)).toUpperCase();
  let h = 0;
  for (const ch of label) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return { text, tone: LOGO_TONES[h % LOGO_TONES.length] };
}

export function toolHost(c: Connection): string {
  return c.id.startsWith('tool:') ? c.id.slice(5) : c.id;
}
