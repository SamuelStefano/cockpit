export const PLANNER_COLUMNS = ['today', 'week', 'backlog', 'done'] as const;
export type PlannerColumn = (typeof PLANNER_COLUMNS)[number];
export type PlannerDifficulty = 1 | 2 | 3;

export interface PlannerLink { url: string; label?: string }

export interface PlannerTask {
  id: string;
  title: string;
  description: string;
  links: PlannerLink[];
  difficulty: PlannerDifficulty;
  column: PlannerColumn;
  order: number;
  createdAt: number;
  updatedAt: number;
  doneAt?: number;
  source?: 'agent';
  ref?: string;
  tag?: string;
}

export interface PlannerMove { id: string; column: PlannerColumn; order: number }

export const PLANNER_LIMITS = {
  tasks: 1000,
  title: 140,
  description: 4000,
  links: 10,
  linkUrl: 2000,
  linkLabel: 80,
  ref: 80,
  tag: 24,
} as const;

export const PLANNER_ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
export const PLANNER_REF_RE = /^[A-Za-z0-9:_.-]{1,80}$/;
