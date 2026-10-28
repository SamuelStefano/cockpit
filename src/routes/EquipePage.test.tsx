// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { EquipePage } from './EquipePage';
import type { BotView } from './equipe/team-view';
import type { Cron, TeamBot } from '../../shared/protocol';
import { navFor } from '../components/chrome/nav-routes';

afterEach(cleanup);
const v = (id: string, over: Partial<BotView['bot']> = {}, state: BotView['state'] = 'idle'): BotView => ({
  bot: { id, name: id, label: `cargo ${id}`, instructions: '', mascot: { shape: 'blob', color: '#fff' }, profile: 'full', createdAt: 0, updatedAt: 0, ...over },
  key: id, preview: '', unread: false, state,
});
const base = () => ({
  views: [v('lia', { primary: true }, 'waiting'), v('growth', { parentId: 'lia' }, 'working')],
  connected: true, isAdmin: true, usageStats: null, paused: false, tab: 'agentes' as const, bots: [] as TeamBot[], onOpenChat: vi.fn(),
  cron: { crons: [] as Cron[], loaded: true, onCronsGet: vi.fn(), onCronSave: vi.fn(), onCronDelete: vi.fn(), onCronRun: vi.fn() },
  onOpenAgent: vi.fn(), onNew: vi.fn(), onPauseSet: vi.fn(), onUsageList: vi.fn(), onGo: vi.fn(),
});

describe('EquipePage', () => {
  it('shows only numbers it can compute and opens an agent from its node', () => {
    const p = base();
    render(<EquipePage {...p} />);
    expect(screen.getByText('trabalhando agora')).toBeTruthy();
    expect(screen.queryByText('tarefas fechadas hoje')).toBeNull();
    expect(screen.queryByText('gasto hoje · estimado')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir growth' }));
    expect(p.onOpenAgent).toHaveBeenCalledWith('growth');
  });
  it('pauses the team and routes the Rotinas tab to /equipe/rotinas and Memória to the existing screen', () => {
    const p = base();
    render(<EquipePage {...p} />);
    fireEvent.click(screen.getByRole('button', { name: /Pausar equipe/ }));
    expect(p.onPauseSet).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole('tab', { name: /Rotinas/ }));
    fireEvent.click(screen.getByRole('tab', { name: /Memória/ }));
    expect(p.onGo.mock.calls).toEqual([['/equipe/rotinas'], ['/contextos']]);
  });
  it('renders the routines inside the Rotinas tab instead of linking away', () => {
    const p = base();
    const routine: Cron = { id: 'r1', name: 'Fechar o dia', prompt: 'resume', schedule: { kind: 'daily', atMinute: 1080, weekdays: [1, 2, 3, 4, 5] }, enabled: true, createdAt: 0, botId: 'lia' };
    render(<EquipePage {...p} tab="rotinas" cron={{ ...p.cron, crons: [routine] }} bots={[v('lia').bot]} />);
    expect(screen.getByText('Fechar o dia')).toBeTruthy();
    expect(screen.getByText('Todo dia útil às 18h')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Nova rotina/ })).toBeTruthy();
    expect(screen.queryByText('trabalhando agora')).toBeNull();
    expect(p.cron.onCronsGet).toHaveBeenCalled();
  });
  it('hides admin actions and skips the usage request for a student', () => {
    const p = { ...base(), isAdmin: false };
    render(<EquipePage {...p} />);
    expect(screen.queryByRole('button', { name: /Pausar equipe/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Novo agente/ })).toBeNull();
    expect(p.onUsageList).not.toHaveBeenCalled();
  });
  it('keeps /equipe in the student menu and nothing else restricted', () => {
    expect(navFor('student').map((n) => n.to)).toEqual(['/', '/equipe', '/agentes']);
  });
});
