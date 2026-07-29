// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { loadPendingAtts, savePendingAtts, addPendingAtt, movePendingAtts, clearPendingAtts } from './pending-atts';
import type { Attachment } from '../useCockpit';

const att = (path: string, extra: Partial<Attachment> = {}): Attachment => ({ name: path, path, ...extra });

describe('pending-atts (anexos do composer por sessão)', () => {
  beforeEach(() => localStorage.clear());

  it('guarda e lê por sessão, sem vazar pra outra', () => {
    savePendingAtts('a', [att('img.png')]);
    expect(loadPendingAtts('a').map((x) => x.path)).toEqual(['img.png']);
    expect(loadPendingAtts('b')).toEqual([]);
  });

  it('não persiste chip em upload (path temporário)', () => {
    savePendingAtts('a', [att('ok.png'), att('cid-1', { uploading: true })]);
    expect(loadPendingAtts('a').map((x) => x.path)).toEqual(['ok.png']);
  });

  it('sessão vazia não grava nada', () => {
    savePendingAtts('', [att('img.png')]);
    expect(loadPendingAtts('')).toEqual([]);
    expect(localStorage.length).toBe(0);
  });

  it('addPendingAtt acumula sem duplicar o mesmo path', () => {
    addPendingAtt('a', att('img.png'));
    addPendingAtt('a', att('doc.pdf'));
    addPendingAtt('a', att('img.png', { name: 'novo' }));
    expect(loadPendingAtts('a').map((x) => x.path)).toEqual(['doc.pdf', 'img.png']);
  });

  it('movePendingAtts leva os pendentes da key local pra sessão real', () => {
    savePendingAtts('new-1', [att('img.png')]);
    movePendingAtts('new-1', 'uuid-1');
    expect(loadPendingAtts('new-1')).toEqual([]);
    expect(loadPendingAtts('uuid-1').map((x) => x.path)).toEqual(['img.png']);
  });

  it('clear apaga a entrada, não deixa key residual', () => {
    savePendingAtts('a', [att('img.png')]);
    clearPendingAtts('a');
    expect(loadPendingAtts('a')).toEqual([]);
    expect(localStorage.length).toBe(0);
  });
});
