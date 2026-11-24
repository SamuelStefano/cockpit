import { describe, expect, it } from 'vitest';
import { orderDesks, stepDesk } from './deskOrder';
import type { FloorAgent } from './types';

const ag = (id: string, wingId: string, x: number, z: number) => ({ id, wingId, x, z }) as FloorAgent;

describe('orderDesks', () => {
  const wings = [{ id: 'deck' }, { id: 'itera' }];
  it('walks wing order, then x, then z, whatever the array order', () => {
    const agents = [ag('c', 'itera', 1, 0), ag('b', 'deck', 5, 0), ag('d', 'deck', 5, -2), ag('a', 'deck', 2, 3), ag('x', 'gone', 0, 0)];
    expect(orderDesks(agents, wings).map((a) => a.id)).toEqual(['a', 'd', 'b', 'c', 'x']);
  });
  it('does not mutate its input', () => {
    const agents = [ag('b', 'deck', 5, 0), ag('a', 'deck', 1, 0)];
    orderDesks(agents, wings);
    expect(agents[0].id).toBe('b');
  });
});

describe('stepDesk', () => {
  const o = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  it('wraps around both ways', () => {
    expect(stepDesk(o, 'c', 1)).toBe('a');
    expect(stepDesk(o, 'a', -1)).toBe('c');
    expect(stepDesk(o, 'a', 1)).toBe('b');
  });
  it('starts at the ends when nothing is selected', () => {
    expect(stepDesk(o, null, 1)).toBe('a');
    expect(stepDesk(o, null, -1)).toBe('c');
    expect(stepDesk([], null, 1)).toBeNull();
  });
});
