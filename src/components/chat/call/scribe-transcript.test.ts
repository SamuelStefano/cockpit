import { describe, expect, it } from 'vitest';
import { ScribeTranscript, toPcm16 } from './scribe-transcript';

describe('ScribeTranscript', () => {
  it('joins commits and the open partial', () => {
    const t = new ScribeTranscript();
    expect(t.onCommit('oi')).toBe('oi');
    expect(t.onPartial('tudo')).toBe('oi tudo');
  });
  it('does not resend text handled before reset', () => {
    const t = new ScribeTranscript();
    t.onPartial('manda isso');
    t.reset();
    expect(t.onPartial('manda isso')).toBe('');
    expect(t.onPartial('manda isso agora')).toBe('agora');
    expect(t.onCommit('manda isso agora')).toBe('agora');
    t.reset();
    expect(t.onPartial('outra')).toBe('outra');
  });
});

describe('toPcm16', () => {
  it('downsamples and clamps', () => {
    const out = toPcm16(new Float32Array([1, 1, 2, 2, -1, -1]), 32000);
    expect(Array.from(out)).toEqual([32767, 32767, -32768]);
  });
});
