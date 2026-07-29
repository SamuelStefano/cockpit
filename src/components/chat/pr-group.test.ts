import { describe, it, expect } from 'vitest';
import { prGroupView } from './pr-group';

describe('prGroupView', () => {
  it('tira o repo repetido do rótulo e deixa só o número', () => {
    const out = prGroupView([
      { label: 'PR #211 · SamuelStefano/cockpit', url: 'https://a' },
      { label: 'PR #212 · SamuelStefano/cockpit', url: 'https://b' },
    ]);
    expect(out.repo).toBe('SamuelStefano/cockpit');
    expect(out.items.map((i) => i.label)).toEqual(['#211', '#212']);
  });

  it('mantém rótulo inteiro quando os repos diferem', () => {
    const out = prGroupView([
      { label: 'PR #1 · a/x', url: 'https://a' },
      { label: 'PR #2 · b/y', url: 'https://b' },
    ]);
    expect(out.repo).toBeNull();
    expect(out.items.map((i) => i.label)).toEqual(['PR #1 · a/x', 'PR #2 · b/y']);
  });

  it('sem repo no rótulo, encurta mesmo assim', () => {
    const out = prGroupView([{ label: 'PR #7', url: 'https://a' }, { label: 'PR #8', url: 'https://b' }]);
    expect(out.repo).toBeNull();
    expect(out.items.map((i) => i.label)).toEqual(['#7', '#8']);
  });

  it('rótulo fora do padrão fica intacto', () => {
    const out = prGroupView([{ label: 'PR aberta', url: 'https://a' }, { label: 'PR #9 · a/x', url: 'https://b' }]);
    expect(out.items.map((i) => i.label)).toEqual(['PR aberta', 'PR #9 · a/x']);
  });
});
