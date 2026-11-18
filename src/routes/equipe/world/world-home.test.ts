import { describe, it, expect } from 'vitest';
import { homeOf } from './world-home';

const houses = [{ id: 'itera' }, { id: 'dfl' }, { id: 'corte-radar' }, { id: 'escritorio' }, { id: 'deck' }, { id: 'sala', kind: 'meeting' }, { id: 'quadro', kind: 'board' }];

describe('homeOf', () => {
  it('uses the home field when the house exists', () => {
    expect(homeOf({ home: 'deck', project: 'itera', sector: 'growth' }, houses)).toBe('deck');
  });
  it('maps design-doc buildings that are not on the map yet', () => {
    expect(homeOf({ home: 'prefeitura' }, houses)).toBe('escritorio');
    expect(homeOf({ home: 'banco' }, houses)).toBe('escritorio');
    expect(homeOf({ home: 'seguranca' }, houses)).toBe('escritorio');
    expect(homeOf({ home: 'servidores' }, houses)).toBe('escritorio');
    expect(homeOf({ home: 'estudio' }, houses)).toBe('corte-radar');
  });
  it('lets a real building win over its alias', () => {
    expect(homeOf({ home: 'banco' }, [...houses, { id: 'banco' }])).toBe('banco');
  });
  it('falls back to the project house, then the department', () => {
    expect(homeOf({ project: 'dfl', sector: 'finance' }, houses)).toBe('dfl');
    expect(homeOf({ home: 'nope', project: 'nope', sector: 'growth' }, houses)).toBe('corte-radar');
    expect(homeOf({ sector: 'direction' }, houses)).toBe('escritorio');
    expect(homeOf({ sector: 'engineering' }, houses)).toBe('escritorio');
  });
  it('never homes a bot in the meeting room or the board', () => {
    expect(homeOf({ home: 'sala' }, houses)).toBe('escritorio');
    expect(homeOf({ project: 'quadro' }, houses)).toBe('escritorio');
  });
  it('ends in the office', () => {
    expect(homeOf({}, houses)).toBe('escritorio');
    expect(homeOf({ home: 'banco' }, [{ id: 'itera' }])).toBe('escritorio');
  });
});
