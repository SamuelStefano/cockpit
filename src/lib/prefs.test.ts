// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { showSessionDescDefault, SHOW_SESSION_DESC_DEFAULT } from './prefs';

const original = window.matchMedia;
const stub = (matches: boolean) => {
  window.matchMedia = ((query: string) => ({ matches, media: query })) as unknown as typeof window.matchMedia;
};

afterEach(() => { window.matchMedia = original; vi.restoreAllMocks(); });

describe('showSessionDescDefault', () => {
  it('liga a descrição por padrão no desktop', () => {
    stub(true);
    expect(showSessionDescDefault()).toBe(true);
  });

  it('desliga abaixo de lg — a lista do celular perde metade dos itens com ela', () => {
    stub(false);
    expect(showSessionDescDefault()).toBe(false);
  });

  it('cai no default do desktop quando não há matchMedia', () => {
    window.matchMedia = undefined as unknown as typeof window.matchMedia;
    expect(showSessionDescDefault()).toBe(SHOW_SESSION_DESC_DEFAULT);
  });
});
