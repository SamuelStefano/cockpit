// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AddProvider } from './AddProvider';
import type { ProviderProbeView } from '../../cockpit/useProviderProbe';

afterEach(cleanup);

const view = (over: Partial<ProviderProbeView> = {}): ProviderProbeView => ({
  probeResult: null, probeBusy: false, onProviderProbe: vi.fn(() => true), onProviderProbeReset: vi.fn(), ...over,
});

describe('AddProvider', () => {
  it('login presets leave to the login flow', () => {
    const onLogin = vi.fn(); const onClose = vi.fn();
    render(<AddProvider open onClose={onClose} probe={view()} onLogin={onLogin} />);
    fireEvent.click(screen.getByText('Gemini'));
    expect(onLogin).toHaveBeenCalled();
  });

  it('probes the typed address with the key and keeps Salvar disabled', () => {
    const p = view();
    render(<AddProvider open onClose={vi.fn()} probe={p} onLogin={vi.fn()} />);
    fireEvent.click(screen.getByText('Outro endereço'));
    fireEvent.change(screen.getByLabelText('Endereço'), { target: { value: 'https://ia.x.com/v1' } });
    fireEvent.change(screen.getByLabelText('Chave'), { target: { value: 'sk-abc' } });
    fireEvent.click(screen.getByText('Testar conexão'));
    expect(p.onProviderProbe).toHaveBeenCalledWith('https://ia.x.com/v1', 'sk-abc');
    expect((screen.getByLabelText('Salvar (em breve)') as HTMLButtonElement).disabled).toBe(true);
  });

  it('lists found models and shows errors without the key', () => {
    const ok = view({ probeResult: { ok: true, models: [
      { id: 'qwen3.5-72b', usable: true, vision: true, tools: true, longContext: false },
      { id: 'whisper-large', usable: false, reason: 'só áudio, não serve pra conversa', vision: false, tools: false, longContext: false },
    ] } });
    const { unmount } = render(<AddProvider open onClose={vi.fn()} probe={ok} onLogin={vi.fn()} />);
    fireEvent.click(screen.getByText('Ollama'));
    expect(screen.getByText(/Encontrei 2 modelos/)).toBeTruthy();
    expect(screen.getByText(/só áudio/)).toBeTruthy();
    unmount();
    render(<AddProvider open onClose={vi.fn()} probe={view({ probeResult: { ok: false, error: 'O servidor recusou a chave.' } })} onLogin={vi.fn()} />);
    fireEvent.click(screen.getByText('Ollama'));
    expect(screen.getByRole('alert').textContent).toBe('O servidor recusou a chave.');
  });
});
