import { describe, it, expect } from 'vitest';
import { transpile } from '../components/primitives/livepreview/transpile';
import { evalComponent } from './appSandboxEval';

const scope = { React: { marker: 'react' }, Button: () => null };

function build(src: string) {
  const r = transpile(src);
  if ('error' in r) throw new Error(r.error);
  return evalComponent(r.code, scope);
}

describe('evalComponent', () => {
  it('devolve o componente exportado por default', () => {
    const r = build('export default function App() { return null; }');
    expect('Component' in r && typeof r.Component).toBe('function');
  });

  it('enxerga o escopo do app sem import', () => {
    const r = build('export default function App() { return Button; }');
    if (!('Component' in r)) throw new Error(r.error);
    expect((r.Component as unknown as () => unknown)()).toBe(scope.Button);
  });

  it('recusa código sem export default', () => {
    const r = build('const x = 1;');
    expect('error' in r && r.error).toContain('export default');
  });

  it('devolve o erro em vez de estourar quando o módulo lança', () => {
    const r = build('throw new Error("explodiu no topo"); export default function App() {}');
    expect('error' in r && r.error).toBe('explodiu no topo');
  });

  it('resolve require("react") e nega o resto', () => {
    const ok = build('import React from "react"; export default function App() { return React; }');
    if (!('Component' in ok)) throw new Error(ok.error);
    expect((ok.Component as unknown as () => unknown)()).toBe(scope.React);

    // Import não usado é elidido pelo transform de TS — precisa ser referenciado
    // pro require de verdade acontecer.
    const bad = build('import fs from "fs"; export default function App() { return fs; }');
    expect('error' in bad && bad.error).toContain('módulo indisponível');
  });
});
