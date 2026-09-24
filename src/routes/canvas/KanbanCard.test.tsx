// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { CanvasCard } from '../../../shared/canvas';
import { KanbanCard } from './KanbanCard';

afterEach(cleanup);

const card = (extra: Partial<CanvasCard> = {}): CanvasCard => ({
  id: 'card-1', title: 'T', prompt: 'P', status: 'doing', kind: 'task', contextIds: [], sessionIds: [], createdAt: 1, updatedAt: 2, ...extra,
});
const noop = () => {};
const props = { sessions: [], selected: false, onSelect: noop, onRun: noop, onEdit: noop, onReview: noop, onOpenSession: noop };

describe('KanbanCard', () => {
  // canvas review item 6: card-review.ts only flips status to 'review' on a
  // CLEAN close — idle sessions with the card still "doing" means the last
  // turn crashed/stopped, not "looks done". The badge used to say the opposite.
  it('cardRun "review" reads red "parou sem terminar", never the old "parece pronto"', () => {
    const { getByText, queryByText } = render(<KanbanCard {...props} card={card()} run="review" />);
    expect(getByText('parou sem terminar')).toBeTruthy();
    expect(queryByText('parece pronto')).toBeNull();
  });

  it('a running card badges "rodando" instead', () => {
    const { getByText, queryByText } = render(<KanbanCard {...props} card={card()} run="running" />);
    expect(getByText('rodando')).toBeTruthy();
    expect(queryByText('parou sem terminar')).toBeNull();
  });

  it('keeps "marcar como feito" as the manual confirmation for a review-run card', () => {
    const { getByText } = render(<KanbanCard {...props} card={card()} run="review" />);
    expect(getByText('marcar como feito')).toBeTruthy();
  });
});
