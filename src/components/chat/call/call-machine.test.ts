import { describe, expect, it } from 'vitest';
import { callReducer, initialCallState, recognizerShouldRun, type CallEvent, type CallState } from './call-machine';

const run = (events: CallEvent[], from: CallState = initialCallState) => events.reduce(callReducer, from);
const type = (t: CallEvent['type']) => ({ type: t }) as CallEvent;

describe('callReducer', () => {
  it('full turn: dial → utterance → reply → done', () => {
    expect(run([type('dial')]).phase).toBe('listening');
    expect(run([type('dial'), type('utterance-sent')]).phase).toBe('thinking');
    expect(run([type('dial'), type('utterance-sent'), type('reply-ready')]).phase).toBe('speaking');
    expect(run([type('dial'), type('utterance-sent'), type('reply-ready'), type('speech-done')]).phase).toBe('listening');
  });

  it('ignores everything but dial while off', () => {
    for (const t of ['utterance-sent', 'reply-ready', 'speech-done', 'barge-in', 'no-reply', 'toggle-mute', 'hangup'] as const) {
      expect(run([type(t)])).toEqual(initialCallState);
    }
  });

  it('dial while in a call does not reset it', () => {
    const s = run([type('dial'), type('toggle-mute'), type('dial')]);
    expect(s).toEqual({ phase: 'listening', muted: true });
  });

  it('barge-in stops speaking and goes back to listening', () => {
    const speaking = run([type('dial'), type('utterance-sent'), type('reply-ready')]);
    expect(callReducer(speaking, type('barge-in')).phase).toBe('listening');
  });

  it('barge-in is a no-op outside speaking', () => {
    const thinking = run([type('dial'), type('utterance-sent')]);
    expect(callReducer(thinking, type('barge-in'))).toBe(thinking);
  });

  it('a reply only starts speech while thinking', () => {
    const listening = run([type('dial')]);
    expect(callReducer(listening, type('reply-ready'))).toBe(listening);
  });

  it('no-reply returns to listening only from thinking', () => {
    expect(run([type('dial'), type('utterance-sent'), type('no-reply')]).phase).toBe('listening');
    const speaking = run([type('dial'), type('utterance-sent'), type('reply-ready')]);
    expect(callReducer(speaking, type('no-reply'))).toBe(speaking);
  });

  it('mute survives phase changes; dial after hangup unmutes', () => {
    const muted = run([type('dial'), type('toggle-mute'), type('utterance-sent'), type('reply-ready'), type('speech-done')]);
    expect(muted).toEqual({ phase: 'listening', muted: true });
    expect(run([type('toggle-mute'), type('hangup'), type('dial')], muted).muted).toBe(false);
  });

  it('hangup from any phase resets', () => {
    for (const events of [[type('dial')], [type('dial'), type('utterance-sent')], [type('dial'), type('utterance-sent'), type('reply-ready')]]) {
      expect(run([...events, type('hangup')])).toEqual(initialCallState);
    }
  });

  it('a new utterance while speaking goes straight to thinking', () => {
    const speaking = run([type('dial'), type('utterance-sent'), type('reply-ready')]);
    expect(callReducer(speaking, type('utterance-sent')).phase).toBe('thinking');
  });
});

describe('recognizerShouldRun', () => {
  it('runs in every live phase unless muted', () => {
    expect(recognizerShouldRun({ phase: 'off', muted: false })).toBe(false);
    for (const phase of ['listening', 'thinking', 'speaking'] as const) {
      expect(recognizerShouldRun({ phase, muted: false })).toBe(true);
      expect(recognizerShouldRun({ phase, muted: true })).toBe(false);
    }
  });
});
