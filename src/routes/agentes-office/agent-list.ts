import { departmentById, DEPARTMENTS } from '../../../shared/departments';
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
