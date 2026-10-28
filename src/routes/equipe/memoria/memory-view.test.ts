import { describe, it, expect } from 'vitest';
import { whenLabel, savedLabel, agentsLabel, sizeLabel, memorySubtitle, newMemoryId } from './memory-view';
import type { Memory, TeamBot } from '../../../../shared/protocol';

const now = new Date(2026, 9, 28, 15, 0).getTime();
const bot = (id: string, name = id): TeamBot => ({ id, name, label: '', instructions: '', mascot: { shape: 'blob', color: '#fff' }, profile: 'full', createdAt: 0, updatedAt: 0 });
const mem = (over: Partial<Memory> = {}): Memory => ({ id: 'm1', title: 'T', body: 'x', agents: [], updatedAt: now, updatedBy: 'user', ...over });

describe('memory-view', () => {
  it('labels dates in plain Portuguese', () => {
    expect(whenLabel(now - 3600_000, now)).toBe('editada hoje');
    expect(whenLabel(new Date(2026, 9, 27, 9).getTime(), now)).toBe('ontem');
    expect(whenLabel(new Date(2026, 9, 20, 9).getTime(), now)).toBe('20 out');
  });
  it('labels how long ago it was saved', () => {
    expect(savedLabel(now - 10_000, now)).toBe('salvo agora');
    expect(savedLabel(now - 120_000, now)).toBe('salvo há 2 min');
    expect(savedLabel(now - 3 * 3600_000, now)).toBe('salvo há 3 h');
  });
  it('pluralizes agents and formats sizes', () => {
    expect(agentsLabel(0)).toBe('nenhum agente');
    expect(agentsLabel(1)).toBe('1 agente');
    expect(agentsLabel(3)).toBe('3 agentes');
    expect(sizeLabel(2_516_582)).toBe('2,4 MB');
  });
  it('shows who updated and counts only agents still on the team', () => {
    expect(memorySubtitle(mem({ agents: ['a', 'gone'] }), [bot('a')], now)).toBe('editada hoje · 1 agente');
    expect(memorySubtitle(mem({ updatedBy: 'a' }), [bot('a', 'Pesquisador')], now)).toBe('atualizada pelo Pesquisador · nenhum agente');
    expect(memorySubtitle(mem({ fileName: 'guia.txt' }), [], now)).toMatch(/^arquivo · 1 B/);
  });
  it('makes ids the server accepts', () => {
    expect(newMemoryId()).toMatch(/^[a-zA-Z0-9_-]{1,80}$/);
  });
});
