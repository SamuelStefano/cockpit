import { describe, it, expect, vi } from 'vitest';
import { toast, subscribeToast, TOAST_DEFAULT_MS, type ToastItem } from './toast-bus';

describe('toast-bus', () => {
  it('entrega a mensagem com defaults (tone ok, duração padrão)', () => {
    const seen: ToastItem[] = [];
    const off = subscribeToast((t) => seen.push(t));
    toast('salvo');
    off();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ message: 'salvo', tone: 'ok', durationMs: TOAST_DEFAULT_MS });
    expect(seen[0].action).toBeUndefined();
  });

  it('repassa tone, ação e duração custom', () => {
    const seen: ToastItem[] = [];
    const off = subscribeToast((t) => seen.push(t));
    const onClick = vi.fn();
    toast('limpo', { tone: 'error', action: { label: 'Desfazer', onClick }, durationMs: 8000 });
    off();
    expect(seen[0].tone).toBe('error');
    expect(seen[0].durationMs).toBe(8000);
    seen[0].action?.onClick();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('gera ids crescentes e únicos', () => {
    const off = subscribeToast(() => {});
    const a = toast('a');
    const b = toast('b');
    off();
    expect(b).toBeGreaterThan(a);
  });

  it('entrega a múltiplos ouvintes e para após unsubscribe', () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = subscribeToast(a);
    const offB = subscribeToast(b);
    toast('x');
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
    offA();
    toast('y');
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledTimes(2);
    offB();
  });
});
