// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { ModelPicker } from './ModelPicker';
import { setPref } from '../../lib/persist';

afterEach(() => { cleanup(); setPref('hiddenModels', []); localStorage.clear(); });

describe('ModelPicker refresh', () => {
  it('shows it is fetching until the new model list arrives', () => {
    const onRefreshModels = vi.fn();
    const models = [{ id: 'claude-sonnet-5', displayName: 'Sonnet 5' }];
    const { getByRole, rerender } = render(<ModelPicker model="claude-sonnet-5" setModel={vi.fn()} models={models} onRefreshModels={onRefreshModels} />);
    fireEvent.click(getByRole('button', { name: 'Buscar modelos novos da Anthropic agora' }));
    expect(onRefreshModels).toHaveBeenCalledTimes(1);
    const busy = getByRole('button', { name: 'Buscando modelos…' }) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    rerender(<ModelPicker model="claude-sonnet-5" setModel={vi.fn()} models={[...models, { id: 'claude-opus-5-5', displayName: 'Opus 5.5' }]} onRefreshModels={onRefreshModels} />);
    expect(getByRole('button', { name: 'Buscar modelos novos da Anthropic agora' })).toBeTruthy();
  });

  it('adds a custom model id inline, without window.prompt', () => {
    const setModel = vi.fn();
    const promptSpy = vi.spyOn(window, 'prompt');
    const { getByRole } = render(<ModelPicker model="claude-sonnet-5" setModel={setModel} models={[{ id: 'claude-sonnet-5', displayName: 'Sonnet 5' }]} onRefreshModels={vi.fn()} />);
    fireEvent.change(getByRole('combobox', { name: 'Versão do agente do próximo prompt' }), { target: { value: '__add__' } });
    const input = getByRole('textbox', { name: 'ID do modelo' });
    fireEvent.change(input, { target: { value: 'claude-mythos-1' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(setModel).toHaveBeenCalledWith('claude-mythos-1');
    expect(promptSpy).not.toHaveBeenCalled();
    promptSpy.mockRestore();
  });
});

describe('ModelPicker visibility', () => {
  const models = [
    { id: 'claude-opus-5', displayName: 'Opus 5' },
    { id: 'claude-haiku-4-5', displayName: 'Haiku 4.5' },
    { id: 'agent:grok', displayName: 'Grok · agente' },
  ];
  const groupLabels = (el: HTMLElement) => [...el.querySelectorAll('optgroup')].map((g) => g.label);

  it('separates Anthropic from other agents', () => {
    const { getByRole } = render(<ModelPicker model="claude-opus-5" setModel={vi.fn()} models={models} onRefreshModels={vi.fn()} />);
    const select = getByRole('combobox');
    expect(groupLabels(select)).toEqual(['Anthropic · Claude', 'Outros agentes']);
  });

  it('drops hidden models and the empty group, but keeps the current one marked', () => {
    setPref('hiddenModels', ['family:haiku', 'agent:grok']);
    const { getByRole } = render(<ModelPicker model="claude-haiku-4-5" setModel={vi.fn()} models={models} onRefreshModels={vi.fn()} />);
    const select = getByRole('combobox');
    expect(groupLabels(select)).toEqual(['Anthropic · Claude']);
    expect(select.textContent).toContain('Haiku 4.5 (oculto)');
    expect(select.textContent).not.toContain('Grok');
  });

  it('offers "Gerenciar modelos…" only to admins and deep-links to the admin tab', () => {
    const student = render(<ModelPicker model="claude-opus-5" setModel={vi.fn()} models={models} onRefreshModels={vi.fn()} />);
    expect(student.getByRole('combobox').textContent).not.toContain('Gerenciar modelos');
    student.unmount();
    const setModel = vi.fn();
    const { getByRole } = render(<ModelPicker model="claude-opus-5" setModel={setModel} models={models} onRefreshModels={vi.fn()} canManage />);
    fireEvent.change(getByRole('combobox'), { target: { value: '__manage__' } });
    expect(location.pathname + location.hash).toBe('/admin#models');
    expect(setModel).not.toHaveBeenCalled();
  });
});
