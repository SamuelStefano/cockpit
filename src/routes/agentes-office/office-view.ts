import { groupByDepartment, type Department } from '../../../shared/departments';
import type { BotState } from '../../components/team/botState';
import { orderTeam, type TeamEntry } from '../../components/team/team-order';
import type { BotView } from '../equipe/team-view';

export interface OfficeSummary { total: number; working: number; waiting: number }

export interface OfficeRoom { key: string; department: Department | null; entries: TeamEntry[]; leaders: ReadonlySet<string> }

export function summarize(views: BotView[]): OfficeSummary {
  return {
    total: views.length,
    working: views.filter((v) => v.state === 'thinking' || v.state === 'working').length,
    waiting: views.filter((v) => v.state === 'waiting').length,
  };
}

export function buildRooms(views: BotView[]): OfficeRoom[] {
  const ids = new Set(views.map((v) => v.bot.id));
  const leaders = new Set(views.flatMap((v) => (v.bot.parentId && ids.has(v.bot.parentId) ? [v.bot.parentId] : [])));
  return groupByDepartment(views, (v) => v.bot.department).map((g) => ({
    key: g.department?.id ?? 'none',
    department: g.department,
    entries: orderTeam(g.items),
    leaders,
  }));
}

export const STATE_DOT: Record<BotState, string> = {
  idle: 'bg-neutral-600',
  thinking: 'bg-sky-400',
  working: 'bg-green-500 shadow-[0_0_0_3px_rgba(34,197,94,0.2)]',
  waiting: 'bg-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,0.2)]',
  error: 'bg-red-500',
  done: 'bg-emerald-400',
};
