import { describe, it, expect } from 'vitest';
import { transpile } from './transpile';

describe('transpile', () => {
  it('reescreve export default de um componente TSX em CommonJS', () => {
    const r = transpile('export default function App() { return <div>oi</div>; }');
    expect('code' in r).toBe(true);
    if ('code' in r) {
      expect(r.code).toContain('exports.default');
      expect(r.code).not.toContain('<div>');
    }
  });

  it('remove tipos TypeScript', () => {
    const r = transpile('const n: number = 1; export default () => <b>{n}</b>;');
    expect('code' in r).toBe(true);
    if ('code' in r) expect(r.code).not.toContain(': number');
  });

  it('reescreve import de react para require', () => {
    const r = transpile("import { useState } from 'react'; export default () => useState(0);");
    expect('code' in r).toBe(true);
    if ('code' in r) expect(r.code).toContain('require');
  });

  it('devolve erro em vez de lançar quando a sintaxe é inválida', () => {
    const r = transpile('export default function( {');
    expect('error' in r).toBe(true);
    if ('error' in r) expect(typeof r.error).toBe('string');
  });
});
