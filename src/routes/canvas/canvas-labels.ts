import type { CardStatus } from '../../../shared/canvas';

// Internal ids (shared/canvas.ts CARD_STATUSES) never changed — this is a
// relabel only, no data migration. "review" is the agent's own signal (a
// doing card/session that stopped cleanly); "done" only ever moves there by
// the user's hand (drag or the "marcar completo" button) — that's the whole
// difference the Done/Completed tooltip below explains.
export const STATUS_LABEL: Record<CardStatus, string> = { todo: 'ToDo', doing: 'In progress', review: 'Done', done: 'Completed' };
export const STATUS_TONE: Record<CardStatus, 'neutral' | 'orange' | 'yellow' | 'green'> = {
  todo: 'neutral', doing: 'orange', review: 'yellow', done: 'green',
};
export const STATUS_HINT: Partial<Record<CardStatus, string>> = {
  review: 'O agente disse que terminou. Ninguém conferiu ainda.',
  done: 'Você conferiu (ou corrigiu) e marcou como completo.',
};
// Semantic zoom: below 70% the title grows in world units so it stays about
// 10px on screen, instead of shrinking into an unreadable sliver.
export const titleSize = (zoom: number) => (zoom >= 0.7 ? 12 : Math.min(10 / zoom, 30));
