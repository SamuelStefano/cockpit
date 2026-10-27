// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ModelPicker } from './ModelPicker';

describe('ModelPicker locked', () => {
  it('shows the fixed model as a label, with no select to change it', () => {
    const { queryByRole, getByText } = render(
      <ModelPicker model="agent:grok" setModel={vi.fn()} models={[{ id: 'agent:grok', displayName: 'Grok · agente' }]} onRefreshModels={vi.fn()} locked="fixado no bot" />,
    );
    expect(queryByRole('combobox')).toBeNull();
    expect(getByText(/fixado no bot/)).toBeTruthy();
  });
});

describe('ModelPicker compact', () => {
  it('drops the tag and the refresh button, keeping only the select', () => {
    const { queryByText, queryByRole, getByRole } = render(
      <ModelPicker compact model="claude-sonnet-5" setModel={vi.fn()} models={[{ id: 'claude-sonnet-5', displayName: 'Sonnet 5' }]} onRefreshModels={vi.fn()} />,
    );
    expect(getByRole('combobox')).toBeTruthy();
    expect(queryByText('versão')).toBeNull();
    expect(queryByRole('button')).toBeNull();
  });

  it('shows a locked model without the reason text', () => {
    const { queryByText, getByText } = render(
      <ModelPicker compact model="agent:grok" setModel={vi.fn()} models={[{ id: 'agent:grok', displayName: 'Grok · agente' }]} onRefreshModels={vi.fn()} locked="fixado no bot" />,
    );
    expect(getByText('Grok · agente')).toBeTruthy();
    expect(queryByText(/fixado no bot/)).toBeNull();
  });
});
