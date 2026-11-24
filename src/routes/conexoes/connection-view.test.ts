import { describe, it, expect } from 'vitest';
import type { Connection } from '../../../shared/connections';
import type { TeamBot } from '../../../shared/protocol';
import { actionOf, lastUsedLabel, logoOf, noticeOf, stateLabel, visibleTabs } from './connection-view';

const c = (o: Partial<Connection>): Connection => ({ id: 'x', kind: 'tool', label: 'X', state: 'connected', ...o });

describe('connection-view', () => {
  it('hides Chaves while there are no key items', () => {
    expect(visibleTabs([c({})])).toEqual(['provedores', 'ferramentas', 'maquinas', 'aparelhos']);
    expect(visibleTabs([c({ kind: 'key' })])).toContain('chaves');
    expect(visibleTabs([c({})], true)).toContain('chaves');
  });

  it('words the state per kind', () => {
    expect(stateLabel({ kind: 'machine', state: 'connected' })).toBe('ligada');
    expect(stateLabel({ kind: 'machine', state: 'off' })).toBe('desligada');
    expect(stateLabel({ kind: 'tool', state: 'expired' })).toBe('falta entrar');
    expect(stateLabel({ kind: 'provider', state: 'expired' })).toBe('expirou');
    expect(stateLabel({ kind: 'device', state: 'off' })).toBe('desconectado');
  });

  it('picks the right verb', () => {
    expect(actionOf(c({ state: 'expired' }))?.label).toBe('Entrar');
    expect(actionOf(c({ state: 'error' }))?.label).toBe('Ver erro');
    expect(actionOf(c({ state: 'off' }))?.label).toBe('Ligar');
    expect(actionOf(c({ state: 'connected' }))).toBeNull();
    expect(actionOf(c({ kind: 'machine', state: 'off' }))).toBeNull();
    expect(actionOf(c({ kind: 'device' }))?.label).toBe('Remover');
  });

  it('builds the notice in consequence language', () => {
    const bots = [{ id: 'b1', name: 'Redator' }] as TeamBot[];
    const n = noticeOf([c({ label: 'Gmail', state: 'expired', usedBy: ['b1'] }), c({ id: 'y', label: 'Slack', state: 'error' })], bots);
    expect(n?.title).toBe('2 conexões precisam de você.');
    expect(n?.body).toBe('falta entrar em Gmail e Slack deu erro — Redator não consegue usar isso até você resolver.');
    expect(n?.short).toBe('Gmail, Slack');
    expect(noticeOf([c({})], bots)).toBeNull();
  });

  it('formats last use', () => {
    const now = 1_000_000_000_000;
    expect(lastUsedLabel(undefined, now)).toBe('—');
    expect(lastUsedLabel(now - 40_000, now)).toBe('há 40 s');
    expect(lastUsedLabel(now - 2 * 3_600_000, now)).toBe('há 2 h');
    expect(lastUsedLabel(now - 30 * 3_600_000, now)).toBe('ontem');
  });

  it('derives a logo letter', () => {
    expect(logoOf('Gmail').text).toBe('G');
    expect(logoOf('dfl-work').text).toBe('DF');
  });
});
