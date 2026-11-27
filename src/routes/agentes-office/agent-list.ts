import { departmentById, DEPARTMENTS } from '../../../shared/departments';
import type { TeamBot, TeamBotInput } from '../../../shared/protocol';
import { MAX_NAME, newBotId } from '../../../shared/team';
import type { AvatarStatus } from '../../components/primitives/Avatar';
import type { BotState } from '../../components/team/botState';
import type { BotView } from '../equipe/team-view';

export type SectorFilter = 'all' | 'none' | string;

export interface SectorChip { id: SectorFilter; label: string }

type StatusTone = 'neutral' | 'green' | 'red' | 'yellow' | 'info';

export interface AgentStatus { label: string; tone: StatusTone; avatar: AvatarStatus }

export const AGENT_STATUS: Record<BotState, AgentStatus> = {
  idle: { label: 'à toa', tone: 'neutral', avatar: 'idle' },
  thinking: { label: 'pensando', tone: 'info', avatar: 'ok' },
  working: { label: 'trabalhando', tone: 'green', avatar: 'ok' },
  waiting: { label: 'esperando você', tone: 'yellow', avatar: 'warn' },
  error: { label: 'parou com erro', tone: 'red', avatar: 'err' },
  done: { label: 'terminou', tone: 'green', avatar: 'ok' },
};

export function sectorChips(views: BotView[]): SectorChip[] {
  const used = new Set(views.map((v) => v.bot.department));
  const chips: SectorChip[] = [{ id: 'all', label: 'Todos' }];
  for (const d of DEPARTMENTS) if (used.has(d.id)) chips.push({ id: d.id, label: d.name });
  if (views.some((v) => !departmentById(v.bot.department))) chips.push({ id: 'none', label: 'Sem setor' });
  return chips;
}

export function filterBySector(views: BotView[], sector: SectorFilter): BotView[] {
  if (sector === 'all') return views;
  return views.filter((v) => (sector === 'none' ? !departmentById(v.bot.department) : v.bot.department === sector));
}

export function agentMeta(view: BotView): string {
  const sector = departmentById(view.bot.department)?.name ?? 'Sem setor';
  return [sector, view.bot.model].filter(Boolean).join(' · ');
}

export interface AgentRowData { view: BotView; isLeader: boolean }

export function agentRowsOf(shown: BotView[], all: BotView[]): AgentRowData[] {
  const ids = new Set(all.map((v) => v.bot.id));
  const leaders = new Set(all.flatMap((v) => (v.bot.parentId && ids.has(v.bot.parentId) ? [v.bot.parentId] : [])));
  return shown.map((view) => ({ view, isLeader: leaders.has(view.bot.id) }));
}

export type StatusFilter = 'all' | 'working' | 'waiting' | 'error' | 'idle';

export interface StatusChip { id: StatusFilter; label: string; count: number }

const STATUS_STATES: Record<Exclude<StatusFilter, 'all'>, readonly BotState[]> = {
  working: ['thinking', 'working'],
  waiting: ['waiting'],
  error: ['error'],
  idle: ['idle', 'done'],
};

const STATUS_LABELS: Record<StatusFilter, string> = { all: 'Todos', working: 'Trabalhando', waiting: 'Esperando você', error: 'Com erro', idle: 'À toa' };

export function filterByStatus(views: BotView[], status: StatusFilter): BotView[] {
  if (status === 'all') return views;
  return views.filter((v) => STATUS_STATES[status].includes(v.state));
}

export function statusChips(views: BotView[]): StatusChip[] {
  return (Object.keys(STATUS_LABELS) as StatusFilter[]).map((id) => ({ id, label: STATUS_LABELS[id], count: filterByStatus(views, id).length }));
}

export function filterBySearch(views: BotView[], query: string): BotView[] {
  const q = query.trim().toLowerCase();
  if (!q) return views;
  return views.filter((v) => [v.bot.name, v.bot.label, v.bot.model].some((f) => f?.toLowerCase().includes(q)));
}

// Names allow no spaces or parentheses (shared/team NAME_RE), so the copy is "<name>-copia[-N]".
export function copyName(name: string, bots: TeamBot[]): string {
  const taken = new Set(bots.map((b) => b.name.toLowerCase()));
  for (let n = 1; ; n++) {
    const suffix = n === 1 ? '-copia' : `-copia-${n}`;
    const candidate = `${name.slice(0, MAX_NAME - suffix.length)}${suffix}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

// A copy is a fresh agent: no id, session, primary flag or repo sync link of the original.
export function copyInput(bot: TeamBot, bots: TeamBot[]): TeamBotInput {
  const { sessionId: _s, rotatedAt: _r, createdAt: _c, updatedAt: _u, sourceSync: _y, previousSessionIds: _p, primary: _m, source: _o, ...rest } = bot;
  return { ...rest, id: newBotId(), name: copyName(bot.name, bots) };
}
