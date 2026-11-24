import { describe, it, expect } from 'vitest';
import type { Message } from '../data/types';
import { buildShareSnapshot, shareId, parseSharePath, parseShareSnapshot } from './share';

const msgs = [
  { id: '1', role: 'user', text: 'hi' },
  { id: '2', role: 'assistant', blocks: [
    { type: 'text', md: 'hello' },
    { type: 'code', lang: 'ts', code: 'x()' },
    { type: 'thinking', text: 'secret thoughts' },
    { type: 'tool', tool: { label: 'Bash', command: 'ls', output: ['TOKEN=abc123'] } },
  ] },
  { id: '3', role: 'compact' },
] as unknown as Message[];

describe('buildShareSnapshot', () => {
  it('strips tool output and thinking', () => {
    const snap = buildShareSnapshot('T', msgs);
    const json = JSON.stringify(snap);
    expect(json).not.toContain('abc123');
    expect(json).not.toContain('secret thoughts');
    expect(snap.v).toBe(1);
    expect(snap.messages[1]).toEqual({ role: 'assistant', blocks: [
      { type: 'text', md: 'hello' }, { type: 'code', lang: 'ts', code: 'x()' }, { type: 'tool', label: 'ls' },
    ] });
    expect(snap.messages[2]).toEqual({ role: 'compact' });
  });
  it('round-trips through the validator', () => {
    expect(parseShareSnapshot(JSON.parse(JSON.stringify(buildShareSnapshot('T', msgs))))).not.toBeNull();
  });
});

describe('shareId', () => {
  it('is 128-bit base64url and unique', () => {
    const a = shareId();
    expect(a).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(shareId()).not.toBe(a);
  });
});

describe('parseSharePath', () => {
  it('accepts valid paths', () => {
    expect(parseSharePath('/s/0b1c-22aa/abc_DEF-123')).toEqual({ uid: '0b1c-22aa', id: 'abc_DEF-123' });
  });
  it.each(['/s/../x', '/s/a/..', '/s/a/b/c', '/s//x', '/s/a/b.json', '/x/a/b', '/s/a%2f/b'])('rejects %s', (p) => {
    expect(parseSharePath(p)).toBeNull();
  });
});

describe('parseShareSnapshot', () => {
  it.each([
    null, 'x', {}, { v: 2, title: 't', createdAt: 1, messages: [] },
    { v: 1, title: 't', createdAt: 1, messages: 'no' },
    { v: 1, title: 't', createdAt: 1, messages: [{ role: 'user' }] },
    { v: 1, title: 't', createdAt: 1, messages: [{ role: 'assistant', blocks: [{ type: 'html', md: '<b>' }] }] },
  ])('rejects bad shape %#', (d) => {
    expect(parseShareSnapshot(d)).toBeNull();
  });
});
