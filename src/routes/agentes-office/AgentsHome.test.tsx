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
});
