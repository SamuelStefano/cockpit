// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { ModelPicker } from './ModelPicker';
import { setPref } from '../../lib/persist';

afterEach(() => { cleanup(); setPref('hiddenModels', []); localStorage.clear(); });

const models = [
  { id: 'claude-opus-5-5', displayName: 'Claude Opus 5.5' },
  { id: 'claude-haiku-4-5', displayName: 'Haiku 4.5' },
  { id: 'agent:grok', displayName: 'Grok · agente' },
];
const props = { setModel: vi.fn(), models, onRefreshModels: vi.fn() };

describe('ModelPicker', () => {
  it('shows a short name on the trigger', () => {
    const { getByRole } = render(<ModelPicker {...props} model="claude-opus-5-5" />);
    expect(getByRole('button', { name: 'Versão do agente do próximo prompt' }).textContent).toBe('Opus 5.5');
  });

  it('opens the panel, picks a model and closes', () => {
    const setModel = vi.fn();
    const { getByRole, getByLabelText, queryByLabelText } = render(<ModelPicker {...props} setModel={setModel} model="claude-opus-5-5" />);
    fireEvent.click(getByRole('button', { name: 'Versão do agente do próximo prompt' }));
    fireEvent.click(getByLabelText('Haiku 4.5'));
    expect(setModel).toHaveBeenCalledWith('claude-haiku-4-5');
    expect(queryByLabelText('Buscar modelo')).toBeNull();
  });

  it('filters by search and offers adding a provider', () => {
    const { getByRole, getByLabelText, queryByLabelText, getByText } = render(<ModelPicker {...props} model="claude-opus-5-5" />);
    fireEvent.click(getByRole('button', { name: 'Versão do agente do próximo prompt' }));
    fireEvent.change(getByLabelText('Buscar modelo'), { target: { value: 'haiku' } });
    expect(queryByLabelText('Haiku 4.5')).toBeTruthy();
    expect(queryByLabelText('Grok · agente')).toBeNull();
    fireEvent.click(getByText('Adicionar modelo ou provedor'));
    expect(location.pathname + location.hash).toBe('/conexoes#adicionar');
  });

  it('offers "Gerenciar" only to admins', () => {
    const student = render(<ModelPicker {...props} model="claude-opus-5-5" />);
    fireEvent.click(student.getByRole('button', { name: 'Versão do agente do próximo prompt' }));
    expect(student.queryByText('Gerenciar')).toBeNull();
    student.unmount();
    const admin = render(<ModelPicker {...props} model="claude-opus-5-5" canManage />);
    fireEvent.click(admin.getByRole('button', { name: 'Versão do agente do próximo prompt' }));
    expect(admin.getByText('Gerenciar')).toBeTruthy();
  });

  it('shows a locked model as a label with no trigger', () => {
    const { queryByRole, getByText } = render(<ModelPicker {...props} model="agent:grok" locked="fixado no bot" />);
    expect(queryByRole('button')).toBeNull();
    expect(getByText(/fixado no bot/)).toBeTruthy();
  });

  it('compact locked drops the reason text', () => {
    const { queryByText } = render(<ModelPicker {...props} compact model="agent:grok" locked="fixado no bot" />);
    expect(queryByText(/fixado no bot/)).toBeNull();
  });
});
