// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { ModelPicker } from './ModelPicker';

afterEach(cleanup);

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
