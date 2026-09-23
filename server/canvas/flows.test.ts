import { describe, expect, it } from 'vitest';
import { flowMarker, type CanvasFlow } from '../../shared/canvas';
import {
  FLOW_RATE_LIMIT_MS, MAX_HOPS, buildFlowPrompt, fillTemplate, flowResult, hopOfPrompt, rateLimited, selectFlowsToFire,
} from './flows';

function flow(over: Partial<CanvasFlow> = {}): CanvasFlow {
  return { id: 'abcd', from: 's:src', to: 'k:dst', template: '', enabled: true, createdAt: 0, fires: 0, ...over };
}

describe('hopOfPrompt', () => {
  it('reads the hop out of a flow marker', () => {
    expect(hopOfPrompt(`oi ${flowMarker('abcd', 3)}`)).toBe(3);
  });

  it('defaults to 0 when there is no marker, or a malformed one', () => {
    expect(hopOfPrompt('sem marcador')).toBe(0);
    expect(hopOfPrompt('[deck-flow:abcd:-1]')).toBe(0);
  });
});

describe('rateLimited', () => {
  it('blocks a flow fired less than 60s ago and lets an older one through', () => {
    expect(rateLimited({ lastFiredAt: 1000 }, 1000 + FLOW_RATE_LIMIT_MS - 1)).toBe(true);
    expect(rateLimited({ lastFiredAt: 1000 }, 1000 + FLOW_RATE_LIMIT_MS)).toBe(false);
    expect(rateLimited({ lastFiredAt: undefined }, 999999)).toBe(false);
  });
});

describe('flowResult', () => {
  it('keeps the whole text under the cap and only the tail past it', () => {
    expect(flowResult('curto')).toBe('curto');
    const long = 'x'.repeat(13_000);
    const capped = flowResult(long);
    expect(capped.length).toBe(12_000);
    expect(capped).toBe(long.slice(-12_000));
  });
});

describe('fillTemplate', () => {
  it('substitutes {{result}} in place', () => {
    expect(fillTemplate('antes {{result}} depois', 'R')).toBe('antes R depois');
  });

  it('appends the result when the template has no placeholder', () => {
    expect(fillTemplate('faça algo', 'R')).toBe('faça algo\n\nR');
  });

  it('falls back to the default template when blank', () => {
    expect(fillTemplate('   ', 'R')).toContain('R');
    expect(fillTemplate('', 'R')).toContain('Continue a partir do resultado');
  });
});

describe('buildFlowPrompt', () => {
  it('appends the hop marker for this flow', () => {
    const p = buildFlowPrompt(flow({ id: 'xyz1', template: '{{result}}' }), 'R', 2);
    expect(p).toBe(`R\n\n${flowMarker('xyz1', 2)}`);
  });
});

describe('selectFlowsToFire', () => {
  const base = { ok: true, sessionId: 'src', prompt: '' };

  it('fires nothing when the turn did not close ok', () => {
    expect(selectFlowsToFire({ ...base, ok: false }, [flow()], 0)).toEqual([]);
  });

  it('matches the source session and stamps hop = 1 for a turn with no marker', () => {
    const r = selectFlowsToFire(base, [flow()], 0);
    expect(r).toEqual([{ flow: flow(), hop: 1 }]);
  });

  it('ignores a disabled flow, a flow from a different source, and a rate-limited one', () => {
    expect(selectFlowsToFire(base, [flow({ enabled: false })], 0)).toEqual([]);
    expect(selectFlowsToFire(base, [flow({ from: 's:other' })], 0)).toEqual([]);
    expect(selectFlowsToFire(base, [flow({ lastFiredAt: 1000 })], 30_000)).toEqual([]);
  });

  it('matches a card-sourced flow only when the prompt carries that card marker', () => {
    const cardFlow = flow({ from: 'k:card1' });
    expect(selectFlowsToFire(base, [cardFlow], 0)).toEqual([]);
    const withMarker = { ...base, prompt: 'trabalho [deck-card:card1]' };
    expect(selectFlowsToFire(withMarker, [cardFlow], 0)).toEqual([{ flow: cardFlow, hop: 1 }]);
  });

  it('bumps the hop from the incoming marker and blocks once it would reach MAX_HOPS', () => {
    const withHop = { ...base, prompt: flowMarker('other', MAX_HOPS - 2) };
    expect(selectFlowsToFire(withHop, [flow()], 0)).toEqual([{ flow: flow(), hop: MAX_HOPS - 1 }]);
    const atCap = { ...base, prompt: flowMarker('other', MAX_HOPS - 1) };
    expect(selectFlowsToFire(atCap, [flow()], 0)).toEqual([]);
  });

  it('fires nothing when the turn carries neither a matching sessionId nor a card marker', () => {
    expect(selectFlowsToFire({ ok: true, sessionId: undefined, prompt: 'oi' }, [flow()], 0)).toEqual([]);
  });
});
