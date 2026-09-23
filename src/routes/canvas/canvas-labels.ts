import type { CardStatus } from '../../../shared/canvas';

export const STATUS_LABEL: Record<CardStatus, string> = { todo: 'ToDo', doing: 'Fazendo', review: 'Revisar', done: 'Feito' };
export const STATUS_TONE: Record<CardStatus, 'neutral' | 'orange' | 'yellow' | 'green'> = {
  todo: 'neutral', doing: 'orange', review: 'yellow', done: 'green',
};
