import { describe, it, expect } from 'vitest';
import { slugify, parseHomesFile, planHomes } from './apply-team-homes.mts';

const team = [
  { id: 'a1', name: 'Íris' }, { id: 'b2', name: 'Otto', home: 'deck', homeSeat: 0 }, { id: 'c3', name: 'Ana', home: 'deck', homeSeat: 4 }, { id: 'd4', name: 'maria-e2e' },
];

describe('slugify', () => {
  it('lowercases and drops accents', () => {
    expect(slugify('Íris')).toBe('iris');
    expect(slugify('Ségurança')).toBe('seguranca');
    expect(slugify('Otto')).toBe('otto');
  });
});

describe('parseHomesFile', () => {
  it('parses the homes object', () => {
    expect(parseHomesFile('{"homes":{"iris":{"house":"prefeitura","seat":0}}}')).toEqual({ homes: { iris: { house: 'prefeitura', seat: 0 } } });
  });
  it.each([
    ['not json', 'x'], ['no homes', '{}'], ['bad house', '{"homes":{"a":{"house":"Bad House","seat":0}}}'],
    ['negative seat', '{"homes":{"a":{"house":"deck","seat":-1}}}'], ['fractional seat', '{"homes":{"a":{"house":"deck","seat":1.5}}}'], ['seat too big', '{"homes":{"a":{"house":"deck","seat":64}}}'],
  ])('rejects %s', (_n, raw) => {
    expect(() => parseHomesFile(raw)).toThrow();
  });
});

describe('planHomes', () => {
  const file = parseHomesFile(JSON.stringify({ homes: { iris: { house: 'prefeitura', seat: 0 }, otto: { house: 'deck', seat: 0 }, ana: { house: 'deck', seat: 1 }, ghost: { house: 'qa', seat: 2 } } }));
  it('plans changes, skips what is set, reports unknown slugs without crashing', () => {
    const p = planHomes(team, file);
    expect(p.changes.map((c) => [c.botId, c.to])).toEqual([['a1', { house: 'prefeitura', seat: 0 }], ['c3', { house: 'deck', seat: 1 }]]);
    expect(p.changes[1]!.from).toEqual({ home: 'deck', homeSeat: 4 });
    expect(p.unchanged).toEqual(['Otto']);
    expect(p.unknownSlugs).toEqual(['ghost']);
    expect(p.botsWithoutHome).toEqual(['maria-e2e']);
  });
});
