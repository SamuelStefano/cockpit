// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { EquipePage } from './EquipePage';
import type { BotView } from './equipe/team-view';
import type { Cron, TeamBot } from '../../shared/protocol';
import { navFor } from '../components/chrome/nav-routes';

afterEach(cleanup);
const media = (matches: boolean) => vi.stubGlobal('matchMedia', (q: string) => ({ matches, media: q, addEventListener: () => {}, removeEventListener: () => {} }));
beforeEach(() => media(false));
const v = (id: string, over: Partial<BotView['bot']> = {}, state: BotView['state'] = 'idle'): BotView => ({
  bot: { id, name: id, label: `cargo ${id}`, instructions: '', mascot: { shape: 'blob', color: '#fff' }, profile: 'full', createdAt: 0, updatedAt: 0, ...over },
  key: id, preview: '', unread: false, state,
});
const base = () => ({
  views: [v('lia', { primary: true }, 'waiting'), v('growth', { parentId: 'lia' }, 'working')],
  connected: true, isAdmin: true, bots: [] as TeamBot[], onOpenChat: vi.fn(),
  cron: { crons: [] as Cron[], loaded: true, onCronsGet: vi.fn(), onCronSave: vi.fn(), onCronDelete: vi.fn(), onCronRun: vi.fn() },
  memory: { memories: [], loaded: true, onList: vi.fn(), onSave: vi.fn(), onDelete: vi.fn() },
  onGo: vi.fn(),
});

describe('EquipePage', () => {
  it('routes the Rotinas tab to /equipe/rotinas and Memória to the existing screen', () => {
    const p = base();
    render(<EquipePage {...p} />);
    fireEvent.click(screen.getByRole('tab', { name: /Rotinas/ }));
    fireEvent.click(screen.getByRole('tab', { name: /Memória/ }));
    expect(p.onGo.mock.calls).toEqual([['/equipe/rotinas'], ['/equipe/memoria']]);
  });
  it('renders the routines inside the Rotinas tab instead of linking away', () => {
    const p = base();
    const routine: Cron = { id: 'r1', name: 'Fechar o dia', prompt: 'resume', schedule: { kind: 'daily', atMinute: 1080, weekdays: [1, 2, 3, 4, 5] }, enabled: true, createdAt: 0, botId: 'lia' };
    render(<EquipePage {...p} tab="rotinas" cron={{ ...p.cron, crons: [routine] }} bots={[v('lia').bot]} />);
    expect(screen.getByText('Fechar o dia')).toBeTruthy();
    expect(screen.getByText('Todo dia útil às 18h')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Nova rotina/ })).toBeTruthy();
    expect(p.cron.onCronsGet).toHaveBeenCalled();
  });
  it('renders the memory screen inside the Memória tab', () => {
    const p = { ...base(), tab: 'memoria' as const };
    render(<EquipePage {...p} />);
    expect(screen.getByText('Nenhuma memória ainda')).toBeTruthy();
    expect(p.memory.onList).toHaveBeenCalled();
  });
  it('hides admin actions and the Memória tab for a student', () => {
    const p = { ...base(), isAdmin: false };
    render(<EquipePage {...p} />);
    expect(screen.queryByRole('button', { name: /Nova rotina/ })).toBeNull();
    expect(screen.queryByRole('tab', { name: /Memória/ })).toBeNull();
  });
  it('bounces a student off /equipe/memoria to the home chat', () => {
    const p = { ...base(), isAdmin: false, tab: 'memoria' as const };
    render(<EquipePage {...p} />);
    expect(p.onGo).toHaveBeenCalledWith('/');
  });
  it('keeps the student menu to chat and settings', () => {
    expect(navFor('student').map((n) => n.to)).toEqual(['/', '/agentes', '/configuracoes']);
  });
});
