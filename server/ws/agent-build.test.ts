import { describe, expect, it } from 'vitest';
import type { ClientMsg } from '../../shared/protocol';
import { cleanBuildRequest } from './agent-build';

type Frame = Extract<ClientMsg, { t: 'agent-build' }>;
const frame = (over: Partial<Frame> = {}): Frame => ({
  t: 'agent-build', reqId: 'r1',
  history: [{ role: 'user', text: 'quero um ajudante de planilhas' }],
  draft: { name: '', label: '', instructions: '', skills: [] },
  ...over,
});

describe('cleanBuildRequest', () => {
  it('accepts a well-formed request', () => {
    expect(cleanBuildRequest(frame())).toMatchObject({ reqId: 'r1' });
  });

  it('requires the conversation to end on a user turn', () => {
    expect(cleanBuildRequest(frame({ history: [{ role: 'user', text: 'a' }, { role: 'assistant', text: 'b' }] }))).toBeNull();
  });

  it('rejects empty, oversized and malformed history', () => {
    expect(cleanBuildRequest(frame({ history: [] }))).toBeNull();
    expect(cleanBuildRequest(frame({ history: Array.from({ length: 41 }, () => ({ role: 'user' as const, text: 'x' })) }))).toBeNull();
    expect(cleanBuildRequest(frame({ history: [{ role: 'system' as never, text: 'x' }] }))).toBeNull();
    expect(cleanBuildRequest(frame({ history: [{ role: 'user', text: 'x'.repeat(9000) }] }))).toBeNull();
  });

  it('rejects bad ids and drafts', () => {
    expect(cleanBuildRequest(frame({ reqId: 5 as never }))).toBeNull();
    expect(cleanBuildRequest(frame({ reqId: 'x'.repeat(65) }))).toBeNull();
    expect(cleanBuildRequest(frame({ draft: null as never }))).toBeNull();
    expect(cleanBuildRequest(frame({ draft: { name: '', label: '', instructions: '', skills: [1] as never } }))).toBeNull();
  });
});
