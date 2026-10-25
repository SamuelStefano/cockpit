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
