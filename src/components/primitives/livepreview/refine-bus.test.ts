import { describe, it, expect, vi } from 'vitest';
import { requestRefine, subscribeRefine } from './refine-bus';

describe('refine-bus', () => {
  it('entrega o texto refinado aos assinantes', () => {
    const fn = vi.fn();
    const off = subscribeRefine(fn);
    requestRefine('mais escuro');
    expect(fn).toHaveBeenCalledWith('mais escuro');
    off();
  });

  it('ignora texto em branco', () => {
    const fn = vi.fn();
    const off = subscribeRefine(fn);
    requestRefine('   ');
    expect(fn).not.toHaveBeenCalled();
    off();
  });

  it('para de entregar após desassinar', () => {
    const fn = vi.fn();
    const off = subscribeRefine(fn);
    off();
    requestRefine('teste');
    expect(fn).not.toHaveBeenCalled();
  });
});
