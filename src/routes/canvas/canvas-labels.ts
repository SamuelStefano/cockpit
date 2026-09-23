import type { CardStatus } from '../../../shared/canvas';

export const STATUS_LABEL: Record<CardStatus, string> = { todo: 'ToDo', doing: 'Fazendo', review: 'Revisar', done: 'Feito' };
export const STATUS_TONE: Record<CardStatus, 'neutral' | 'orange' | 'yellow' | 'green'> = {
  todo: 'neutral', doing: 'orange', review: 'yellow', done: 'green',
};
// Semantic zoom: below 70% the title grows in world units so it stays about
// 10px on screen, instead of shrinking into an unreadable sliver.
export const titleSize = (zoom: number) => (zoom >= 0.7 ? 12 : Math.min(10 / zoom, 30));
