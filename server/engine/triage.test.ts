import { describe, it, expect } from 'vitest';
import { parseVerdict, classifyArgs, TRIAGE_SYSTEM_PROMPT, QUICK_ANSWER_ARGS } from './triage';

describe('parseVerdict', () => {
  it('falls back to wait on empty/garbage input', () => {
    expect(parseVerdict('').action).toBe('wait');
    expect(parseVerdict('no json here').action).toBe('wait');
    expect(parseVerdict('{not valid').action).toBe('wait');
  });

  it('accepts each valid action', () => {
    for (const a of ['wait', 'answer', 'priority', 'merge'] as const) {
      expect(parseVerdict(`{"action":"${a}","reason":"x"}`).action).toBe(a);
    }
  });

  it('falls back to wait on an unknown action (never mis-interrupts)', () => {
    expect(parseVerdict('{"action":"kill","reason":"x"}').action).toBe('wait');
    expect(parseVerdict('{"reason":"no action"}').action).toBe('wait');
  });

  it('unwraps JSON embedded in surrounding text/fences', () => {
    const v = parseVerdict('```json\n{"action":"priority","reason":"urgent fix"}\n```');
    expect(v.action).toBe('priority');
    expect(v.reason).toBe('urgent fix');
  });

  it('coerces a missing reason to an empty string', () => {
    expect(parseVerdict('{"action":"merge"}').reason).toBe('');
  });

  it('truncates the reason to 80 chars', () => {
    const long = 'a'.repeat(200);
    expect(parseVerdict(`{"action":"wait","reason":"${long}"}`).reason.length).toBe(80);
  });
});

describe('triage argv', () => {
  it('classify runs lean with its own system prompt', () => {
    const args = classifyArgs(true);
    expect(args[args.indexOf('--tools') + 1]).toBe('');
    expect(args[args.indexOf('--system-prompt') + 1]).toBe(TRIAGE_SYSTEM_PROMPT);
  });

  it('classify keeps the old argv when lean one-shots are off', () => {
    expect(classifyArgs(false)).toEqual([]);
  });

  it('quick answer keeps its tools and settings, only skips the transcript', () => {
    expect([...QUICK_ANSWER_ARGS]).toEqual(['--no-session-persistence']);
  });
});
