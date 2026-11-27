import { describe, expect, it } from 'vitest';
import { pendingRequests, requestsLabel } from './mobile-pending';

const v = (state: string, pending?: unknown) => ({ bot: { id: state }, state, pending }) as never;

describe('mobile-pending', () => {
  it('counts agents that ask or wait', () => {
    expect(pendingRequests([v('idle'), v('waiting'), v('idle', { questions: [] })])).toBe(2);
  });
  it('pluralizes the line', () => {
    expect(requestsLabel(1)).toBe('1 pedido esperando você');
    expect(requestsLabel(3)).toBe('3 pedidos esperando você');
  });
});
