// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { BotView } from '../equipe/team-view';
import { DepartmentRoom } from './DepartmentRoom';
import { buildRooms } from './office-view';

afterEach(cleanup);

const view = (id: string, over: Partial<BotView['bot']> = {}) => ({
  bot: { id, name: id, label: '', instructions: '', mascot: { shape: 'blob', color: '#fff' }, profile: 'full', createdAt: 0, updatedAt: 0, ...over },
  key: id, preview: '', unread: false, state: 'idle',
}) as BotView;

describe('DepartmentRoom', () => {
  it('titles the room with the department name and a singular count', () => {
    const [room] = buildRooms([view('a', { department: 'finance' })]);
    render(<DepartmentRoom room={room} onOpen={() => {}} />);
    expect(screen.getByRole('region', { name: 'Finanças' })).toBeTruthy();
    expect(screen.getByText('1 agente')).toBeTruthy();
  });
  it('falls back to Sem setor with a plural count', () => {
    const [room] = buildRooms([view('a'), view('b')]);
    render(<DepartmentRoom room={room} onOpen={() => {}} />);
    expect(screen.getByRole('region', { name: 'Sem setor' })).toBeTruthy();
    expect(screen.getByText('2 agentes')).toBeTruthy();
  });
});
