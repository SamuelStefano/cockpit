import { describe, it, expect } from 'vitest';
import { remapOpen } from './queued-open';

describe('remapOpen', () => {
  it('cancelar item antes do expandido desloca a expansão junto', () => {
    expect(remapOpen(['a', 'b', 'c'], ['b', 'c'], { 1: true })).toEqual({ 0: true });
  });

  it('drenar o topo da fila desloca a expansão junto', () => {
    expect(remapOpen(['a', 'b', 'c'], ['b', 'c'], { 2: true })).toEqual({ 1: true });
  });

  it('cancelar o próprio item expandido remove a expansão', () => {
    expect(remapOpen(['a', 'b', 'c'], ['a', 'c'], { 1: true })).toEqual({});
  });

  it('reordenar (swap) acompanha o item', () => {
    expect(remapOpen(['a', 'b', 'c'], ['b', 'a', 'c'], { 0: true })).toEqual({ 1: true });
  });

  it('duplicatas casam por ocorrência, sem duplicar expansão', () => {
    expect(remapOpen(['x', 'x', 'y'], ['x', 'y'], { 0: true, 1: true })).toEqual({ 0: true });
  });

  it('nada expandido retorna vazio', () => {
    expect(remapOpen(['a', 'b'], ['b'], {})).toEqual({});
  });

  it('fila inalterada preserva expansões', () => {
    expect(remapOpen(['a', 'b'], ['a', 'b'], { 0: true, 1: true })).toEqual({ 0: true, 1: true });
  });
});
