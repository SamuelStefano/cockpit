import { describe, it, expect } from 'vitest';
import { packageOf, vendorChunk } from './vendor-chunks.ts';

const nm = (p: string) => `/home/x/cockpit/node_modules/${p}`;

describe('packageOf', () => {
  it('lê o pacote de escopo com o escopo junto', () => {
    expect(packageOf(nm('@supabase/supabase-js/dist/module/index.js'))).toBe('@supabase/supabase-js');
  });

  it('resolve pelo último node_modules, não pelo primeiro', () => {
    // Dependência aninhada: casar o primeiro daria 'sucrase' pra um arquivo que
    // não é do sucrase, e ele iria pro chunk errado.
    expect(packageOf(nm('sucrase/node_modules/ts-interface-checker/dist/index.js'))).toBe('ts-interface-checker');
  });

  it('devolve null pra código do app', () => {
    expect(packageOf('/home/x/cockpit/src/main.tsx')).toBeNull();
  });
});

describe('vendorChunk', () => {
  it('manda subcaminho e entrada raiz do mesmo pacote pro mesmo chunk', () => {
    // O React 19 separou `react-dom/client` de `react-dom`; casando por pacote,
    // essa mudança não tira nada do chunk de vendor.
    expect(vendorChunk(nm('react-dom/client.js'))).toBe('react');
    expect(vendorChunk(nm('react-dom/index.js'))).toBe('react');
    expect(vendorChunk(nm('react/jsx-runtime.js'))).toBe('react');
    expect(vendorChunk(nm('scheduler/index.js'))).toBe('react');
  });

  it('não confunde pacote cujo nome começa igual', () => {
    expect(vendorChunk(nm('react-native-web/dist/index.js'))).toBeUndefined();
  });

  it('pega o escopo inteiro quando a regra é de escopo', () => {
    expect(vendorChunk(nm('@xterm/xterm/lib/xterm.js'))).toBe('xterm');
    expect(vendorChunk(nm('@xterm/addon-fit/lib/addon-fit.js'))).toBe('xterm');
    expect(vendorChunk(nm('@supabase/postgrest-js/dist/index.js'))).toBe('supabase');
  });

  it('deixa o resto no chunk do app', () => {
    expect(vendorChunk(nm('jspdf/dist/jspdf.es.min.js'))).toBeUndefined();
    expect(vendorChunk('/home/x/cockpit/src/App.tsx')).toBeUndefined();
  });
});
