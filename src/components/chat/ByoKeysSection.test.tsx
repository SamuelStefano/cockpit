// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { AgentsApi } from '../../cockpit/useAgents';
import { ByoKeysSection } from './ByoKeysSection';

afterEach(cleanup);

function api(over: Partial<AgentsApi> = {}) {
  return { byoKeys: [], byoMessage: null, saveByoKey: vi.fn(() => true), removeByoKey: vi.fn(), refreshByoKeys: vi.fn(), ...over } as Required<Pick<AgentsApi, 'byoKeys' | 'byoMessage' | 'saveByoKey' | 'removeByoKey' | 'refreshByoKeys'>>;
}

describe('ByoKeysSection', () => {
  it('asks the box for the saved keys on mount', () => {
    const a = api();
    render(<ByoKeysSection agents={a} />);
    expect(a.refreshByoKeys).toHaveBeenCalledTimes(1);
  });

  it('lists the three providers and sends the key, then clears the field', () => {
    const a = api();
    render(<ByoKeysSection agents={a} />);
    for (const n of ['OpenRouter', 'Z.ai (GLM)', 'DeepSeek']) expect(screen.getByText(n)).toBeTruthy();
    const input = screen.getByLabelText('Chave de API do DeepSeek') as HTMLInputElement;
    expect(input.type).toBe('password');
    fireEvent.change(input, { target: { value: 'sk-secret-1234' } });
    fireEvent.click(input.closest('form')!.querySelector('button')!);
    expect(a.saveByoKey).toHaveBeenCalledWith('deepseek', 'sk-secret-1234');
    expect(input.value).toBe('');
  });

  it('shows only the last 4 chars of a configured key and allows removing it', () => {
    const a = api({ byoKeys: [{ provider: 'zai', configured: true, last4: 'abcd' }] });
    const { container } = render(<ByoKeysSection agents={a} />);
    expect(screen.getByText('Chave salva · final abcd')).toBeTruthy();
    expect(container.innerHTML).not.toMatch(/sk-/);
    fireEvent.click(screen.getByText('Remover'));
    expect(a.removeByoKey).toHaveBeenCalledWith('zai');
  });

  it('keeps the typed key when the send fails', () => {
    render(<ByoKeysSection agents={api({ saveByoKey: vi.fn(() => false) })} />);
    const input = screen.getByLabelText('Chave de API do OpenRouter') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'sk-or-123456' } });
    fireEvent.submit(input.closest('form')!);
    expect(input.value).toBe('sk-or-123456');
  });
});
