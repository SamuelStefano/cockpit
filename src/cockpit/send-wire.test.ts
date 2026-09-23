import { describe, it, expect } from 'vitest';
import { buildForkWire, buildSendWire, type SendWireCtx } from './send-wire';

const ctx = (over: Partial<SendWireCtx> = {}): SendWireCtx => ({
  canBypass: false, bypassOn: false, selectedSkills: [], selectedMcps: [],
  mode: 'auto', effort: 'medium', ...over,
});

describe('buildSendWire', () => {
  it('builds a plain send frame with no optional fields wired when nothing is set', () => {
    const wire = buildSendWire(ctx(), 'sess-1', 'sess-1', 'oi', 'm1', 'opus');
    expect(wire).toEqual({
      t: 'send', sessionKey: 'sess-1', sessionId: 'sess-1', text: 'oi', msgId: 'm1',
      mode: 'auto', model: 'opus', effort: 'medium',
      bypass: undefined, skills: undefined, mcps: undefined, auto: undefined, allowWorkflow: undefined,
    });
  });

  it('bypass only goes on the wire when BOTH the server announced the capability AND the user turned it on', () => {
    expect(buildSendWire(ctx({ canBypass: true, bypassOn: false }), 'k', 'k', 't', 'm', 'opus').bypass).toBeUndefined();
    expect(buildSendWire(ctx({ canBypass: false, bypassOn: true }), 'k', 'k', 't', 'm', 'opus').bypass).toBeUndefined();
    expect(buildSendWire(ctx({ canBypass: true, bypassOn: true }), 'k', 'k', 't', 'm', 'opus').bypass).toBe(true);
  });

  it('skills/mcps only go on the wire when the user restricted a subset', () => {
    const wire = buildSendWire(ctx({ selectedSkills: ['dfl-code-style'], selectedMcps: ['dfl-work'] }), 'k', 'k', 't', 'm', 'opus');
    expect(wire.skills).toEqual(['dfl-code-style']);
    expect(wire.mcps).toEqual(['dfl-work']);
  });

  it('a mode override wins over ctx.mode; without one, ctx.mode is used', () => {
    expect(buildSendWire(ctx({ mode: 'plan' }), 'k', 'k', 't', 'm', 'opus').mode).toBe('plan');
    expect(buildSendWire(ctx({ mode: 'plan' }), 'k', 'k', 't', 'm', 'opus', 'acceptEdits').mode).toBe('acceptEdits');
  });

  it('auto/allowWorkflow are only wired when truthy (never `false` on the wire)', () => {
    const off = buildSendWire(ctx(), 'k', 'k', 't', 'm', 'opus', undefined, false, false);
    expect(off.auto).toBeUndefined();
    expect(off.allowWorkflow).toBeUndefined();
    const on = buildSendWire(ctx(), 'k', 'k', 't', 'm', 'opus', undefined, true, true);
    expect(on.auto).toBe(true);
    expect(on.allowWorkflow).toBe(true);
  });

  // The whole point of extracting this: onSend (the composer) and onSendTo
  // (the canvas prompt bar) call the SAME function, so a prompt from the
  // canvas can never drift from what the composer would have sent for the
  // same text/session — this is the parity guarantee, proven once here
  // instead of duplicated per call site.
  it('two calls with the same ctx/session/text/model produce byte-identical wire frames', () => {
    const shared = ctx({ canBypass: true, bypassOn: true, selectedSkills: ['a'], selectedMcps: ['b'], mode: 'plan', effort: 'high' });
    const fromComposer = buildSendWire(shared, 'sess-9', 'sess-9', 'faz X', 'msg-a', 'sonnet');
    const fromCanvasBar = buildSendWire(shared, 'sess-9', 'sess-9', 'faz X', 'msg-b', 'sonnet');
    expect({ ...fromComposer, msgId: undefined }).toEqual({ ...fromCanvasBar, msgId: undefined });
  });
});

describe('buildForkWire', () => {
  it('builds a canvas-card-fork frame with the same ctx-resolution rules as buildSendWire', () => {
    const wire = buildForkWire(ctx({ canBypass: true, bypassOn: true, selectedSkills: ['a'], selectedMcps: ['b'] }), 'parent-1', 'card-1', 'siga daqui', 'sonnet');
    expect(wire).toEqual({
      t: 'canvas-card-fork', parentSessionId: 'parent-1', cardId: 'card-1', text: 'siga daqui',
      mode: 'auto', model: 'sonnet', effort: 'medium', bypass: true, skills: ['a'], mcps: ['b'],
    });
  });

  it('bypass/skills/mcps stay off the wire with nothing selected', () => {
    const wire = buildForkWire(ctx(), 'parent-1', 'card-1', 'x', 'opus');
    expect(wire.bypass).toBeUndefined();
    expect(wire.skills).toBeUndefined();
    expect(wire.mcps).toBeUndefined();
  });
});
