// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AgentsHome } from './AgentsHome';

afterEach(cleanup);

const base = { views: [], bots: [], skills: [], connected: true, canEdit: true, onSave: vi.fn(), onOpen: vi.fn(), onProfile: vi.fn(), onNew: vi.fn() };

describe('AgentsHome', () => {
  it('shows the Office on the Escritório tab and switches through onTab', () => {
    const onTab = vi.fn();
    render(<AgentsHome {...base} tab="escritorio" onTab={onTab} />);
    expect(screen.getByRole('tab', { name: 'Escritório' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Nenhum agente ainda')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Loja' }));
    expect(onTab).toHaveBeenCalledWith('loja');
  });

  it('shows the store on the Loja tab and asks for the skill list', () => {
    const onSkillList = vi.fn();
    render(<AgentsHome {...base} tab="loja" onTab={vi.fn()} onSkillList={onSkillList} />);
    expect(screen.getByRole('region', { name: 'Engenharia' })).toBeTruthy();
    expect(onSkillList).toHaveBeenCalled();
  });

  it('shows the meeting room on the Reuniões tab and asks for the list', () => {
    const onMeetingsGet = vi.fn();
    const onTab = vi.fn();
    render(<AgentsHome {...base} tab="reunioes" onTab={onTab} onMeetingsGet={onMeetingsGet} />);
    expect(screen.getByRole('tab', { name: 'Reuniões' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('button', { name: /Nova reunião/ })).toBeTruthy();
    expect(onMeetingsGet).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('tab', { name: 'Loja' }));
    expect(onTab).toHaveBeenCalledWith('loja');
  });

  it('has the Executor tab, shows it, and asks for the state when it opens', () => {
    const onHeavyGet = vi.fn();
    const onTab = vi.fn();
    render(<AgentsHome {...base} tab="executor" onTab={onTab} onHeavyGet={onHeavyGet} executor={{ configured: true, label: 'PC', online: true }} />);
    expect(onHeavyGet).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('region', { name: 'Status do executor' })).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Escritório' }));
    expect(onTab).toHaveBeenCalledWith('escritorio');
  });

  it('requests the executor state for admins only', () => {
    const onHeavyGet = vi.fn();
    render(<AgentsHome {...base} canEdit={false} tab="escritorio" onTab={vi.fn()} onHeavyGet={onHeavyGet} />);
    expect(onHeavyGet).not.toHaveBeenCalled();
  });

  it('opens the Executor tab from the Office chip', () => {
    const onTab = vi.fn();
    const views = [{ bot: { id: 'a', name: 'a', label: '', instructions: '', mascot: { shape: 'blob', color: '#3b82f6' }, profile: 'full', createdAt: 0, updatedAt: 0 }, key: 'a', preview: '', unread: false, state: 'idle' }] as never;
    render(<AgentsHome {...base} views={views} tab="escritorio" onTab={onTab} executor={{ configured: true, label: 'PC', online: true }} />);
    fireEvent.click(screen.getByRole('button', { name: 'PC online' }));
    expect(onTab).toHaveBeenCalledWith('executor');
  });

  it('lists agents by default, opens the workspace tab, and keeps the Office view behind the toggle', () => {
    const onProfile = vi.fn();
    const views = [{ bot: { id: 'a', name: 'a', label: '', instructions: '', mascot: { shape: 'blob', color: '#3b82f6' }, profile: 'full', createdAt: 0, updatedAt: 0 }, key: 'a', preview: '', unread: false, state: 'idle' }] as never;
    render(<AgentsHome {...base} views={views} onProfile={onProfile} tab="escritorio" onTab={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Workspace de a' }));
    expect(onProfile).toHaveBeenCalledWith('a', 'arquivos');
    expect(screen.queryByRole('region', { name: 'Sem setor' })).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'Escritório' }));
    expect(screen.getByRole('region', { name: 'Sem setor' })).toBeTruthy();
  });
});
