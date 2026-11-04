import type { CanvasCard } from '../../../shared/canvas';

// A kanban card shown as a screen on the Mission Room wall.
export type MissionSize = 'S' | 'M' | 'L';

export interface Mission {
  id: string; // CanvasCard.id
  title: string;
  summary: string; // one line, <= 90 chars
  description: string; // full card prompt
  size: MissionSize;
  status: 'todo' | 'doing';
  xp: number; // S=10, M=25, L=50
  suggested: boolean; // exactly one mission is suggested when the list is non-empty
  reason: string; // why this one is suggested (empty when not suggested)
}

// Implemented in missions.ts by the data agent; the 3D agent only consumes Mission[].
export declare function buildMissions(cards: CanvasCard[], now: number): Mission[];
