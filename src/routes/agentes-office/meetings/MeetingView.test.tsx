// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { applyAnswer } from '../../../../shared/team-meeting';
import { MeetingView } from './MeetingView';
import { bots, meeting } from './meetings.fixtures';

afterEach(cleanup);

describe('MeetingView', () => {
  it('shows delivered answers as sealed and never their text while round 1 is open', () => {
    const m = applyAnswer(meeting(), 'a1', 1, 'SECRET TEXT', 11);
    const sealed = { ...m, answers: m.answers.map((a) => ({ ...a, text: '' })) };
    const { container } = render(<MeetingView meeting={sealed} bots={bots} />);
    const round1 = screen.getByRole('region', { name: 'Rodada 1' });
    expect(within(round1).getByText('entregue, lacrada')).toBeTruthy();
    expect(within(round1).getByText('escrevendo…')).toBeTruthy();
    expect(container.textContent).not.toContain('SECRET');
    expect(screen.queryByRole('region', { name: 'Rodada 2' })).toBeNull();
  });

  it('reveals round 1 and opens round 2 once everyone answered', () => {
    let m = applyAnswer(meeting(), 'a1', 1, 'Ana says yes', 11);
    m = applyAnswer(m, 'b2', 1, 'Beto says no', 12);
    render(<MeetingView meeting={m} bots={bots} />);
    expect(within(screen.getByRole('region', { name: 'Rodada 1' })).getByText('Ana says yes')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Rodada 2' })).getAllByText('escrevendo…')).toHaveLength(2);
  });

  it('renders the minutes as pre-wrapped text', () => {
    render(<MeetingView meeting={meeting({ status: 'done', minutes: 'Decisão\nlinha 2' })} bots={bots} />);
    const minutes = screen.getByRole('region', { name: 'Ata' }).querySelector('p')!;
    expect(minutes.className).toContain('whitespace-pre-wrap');
    expect(minutes.textContent).toBe('Decisão\nlinha 2');
  });

  it('shows a failure plainly with its error and keeps the answers', () => {
    const m = { ...applyAnswer(meeting(), 'a1', 1, 'kept', 11), status: 'failed' as const, error: 'Beto não respondeu na rodada 1' };
    render(<MeetingView meeting={m} bots={bots} />);
    expect(screen.getByRole('alert').textContent).toContain('Beto não respondeu na rodada 1');
    expect(screen.getByText('kept')).toBeTruthy();
  });

  it('seats every participant as a mascot', () => {
    render(<MeetingView meeting={meeting()} bots={bots} />);
    const table = screen.getByRole('group', { name: 'Mesa' });
    expect(within(table).getAllByRole('img')).toHaveLength(2);
  });
});
