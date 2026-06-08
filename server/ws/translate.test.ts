import { describe, it, expect, beforeEach, vi } from 'vitest';
import { translate } from './translate';
import { threads, type Thread } from './runs';
import { getLastRate } from './rate';
import { broadcast } from './broadcast';

vi.mock('./broadcast', () => ({ broadcast: vi.fn(), send: vi.fn(), setWss: vi.fn() }));

const KEY = 'k';

function freshThread(): Thread {
  return { handle: { kill: () => {} }, prompt: '', startedAt: 0, text: '', thinking: '', tools: [], toolStart: new Map() };
}
function register(): Thread {
  const t = freshThread();
  threads.set(KEY, t);
  return t;
}

beforeEach(() => { threads.clear(); vi.mocked(broadcast).mockClear(); });

describe('translate', () => {
  it('drops frames from a run superseded on the same key', () => {
    register();
    const stale = freshThread();
    translate(KEY, stale, { type: 'result', total_cost_usd: 9, subtype: 'success' } as never);
    expect(stale.costUsd).toBeUndefined();
    expect(stale.endReason).toBeUndefined();
  });

  it('normalizes a rate-limit reset given in epoch seconds to ms', () => {
    const t = register();
    const secs = Math.floor(Date.now() / 1000) + 3600; // futuro: getLastRate não expira
    translate(KEY, t, { type: 'rate_limit_event', rate_limit_info: { resetsAt: secs, status: 'limited' } } as never);
    expect(getLastRate()?.resetsAt).toBe(secs * 1000);
  });

  it('leaves a reset already in ms untouched', () => {
    const t = register();
    const ms = Date.now() + 3_600_000; // futuro: getLastRate não expira
    translate(KEY, t, { type: 'rate_limit_event', rate_limit_info: { resetsAt: ms, status: 'allowed' } } as never);
    expect(getLastRate()?.resetsAt).toBe(ms);
  });

  it('expires a stale rate window (resetsAt já passou) on read', () => {
    const t = register();
    const past = Math.floor(Date.now() / 1000) - 3600; // 1h atrás, em segundos
    translate(KEY, t, { type: 'rate_limit_event', rate_limit_info: { resetsAt: past, status: 'limited' } } as never);
    expect(getLastRate()).toBeNull();
  });

  it('ignores a non-finite/negative total_cost_usd from result', () => {
    const t = register();
    translate(KEY, t, { type: 'result', total_cost_usd: NaN, subtype: 'success' } as never);
    expect(t.costUsd).toBeUndefined();
    translate(KEY, t, { type: 'result', total_cost_usd: -5, subtype: 'success' } as never);
    expect(t.costUsd).toBeUndefined();
  });

  it('captures cost/duration/turns/endReason from result', () => {
    const t = register();
    translate(KEY, t, { type: 'result', total_cost_usd: 0.42, duration_ms: 1500, num_turns: 3, subtype: 'success' } as never);
    expect(t.costUsd).toBe(0.42);
    expect(t.durationMs).toBe(1500);
    expect(t.numTurns).toBe(3);
    expect(t.endReason).toBe('success');
  });

  it('captures the effective model and session id from a system event', () => {
    const t = register();
    translate(KEY, t, { type: 'system', model: 'claude-opus', session_id: 'sid-1' } as never);
    expect(t.model).toBe('claude-opus');
    expect(t.sessionId).toBe('sid-1');
  });

  it('does not overwrite an already-established session id', () => {
    const t = register();
    t.sessionId = 'first';
    translate(KEY, t, { type: 'result', session_id: 'second', subtype: 'success' } as never);
    expect(t.sessionId).toBe('first');
  });

  it('captures the session id on an assistant event so usage records under it', () => {
    const t = register();
    translate(KEY, t, { type: 'assistant', session_id: 'sid-asst', message: { model: 'claude-opus', usage: { output_tokens: 1 } } } as never);
    expect(t.sessionId).toBe('sid-asst');
  });

  it('broadcasts a compact message on a compact_boundary system event (DR-012)', () => {
    const t = register();
    translate(KEY, t, { type: 'system', subtype: 'compact_boundary', session_id: 'sid-c', compact_metadata: { trigger: 'auto', pre_tokens: 150000 } } as never);
    expect(broadcast).toHaveBeenCalledWith({ t: 'compact', sessionKey: KEY, trigger: 'auto', preTokens: 150000 });
  });

  it('does not broadcast compact for a plain system event', () => {
    const t = register();
    translate(KEY, t, { type: 'system', model: 'claude-opus', session_id: 'sid-2' } as never);
    expect(broadcast).not.toHaveBeenCalledWith(expect.objectContaining({ t: 'compact' }));
  });

  it('appends streamed text and thinking deltas to the snapshot', () => {
    const t = register();
    translate(KEY, t, { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'hel' } } } as never);
    translate(KEY, t, { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'lo' } } } as never);
    translate(KEY, t, { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: 'hmm' } } } as never);
    expect(t.text).toBe('hello');
    expect(t.thinking).toBe('hmm');
  });
});
