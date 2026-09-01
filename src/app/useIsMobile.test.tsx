// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { useIsMobile } from './useIsMobile';

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    addListener: () => {}, removeListener: () => {},
  }));
}

// Coleta TODOS os valores renderizados, não só o final: o bug era o primeiro render
// dizer "desktop" e um segundo corrigir. O resultado final já estava certo antes do
// fix — o custo estava no render descartado, que monta o layout de três painéis (e o
// terminal, que puxa o chunk do xterm) no aparelho que menos pode pagar por isso.
function renderedValues(): boolean[] {
  const seen: boolean[] = [];
  function Probe() {
    seen.push(useIsMobile());
    return null;
  }
  render(<Probe />);
  return seen;
}

afterEach(() => vi.unstubAllGlobals());

describe('useIsMobile', () => {
  it('já nasce mobile, sem passar por um render de desktop', () => {
    stubMatchMedia(true);
    expect(renderedValues()).not.toContain(false);
  });

  it('nasce desktop quando a media query não casa', () => {
    stubMatchMedia(false);
    expect(renderedValues().every((v) => v === false)).toBe(true);
  });
});
