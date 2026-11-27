import { expect, it } from 'vitest';
import { createRateLimiter } from './rateLimit.ts';

it('allows the limit per window and recovers after it', () => {
  let t = 0;
  const rl = createRateLimiter(5, 1000, () => t);
  for (let i = 0; i < 5; i++) expect(rl.hit('ip')).toBe(true);
  expect(rl.hit('ip')).toBe(false);
  expect(rl.hit('other')).toBe(true);
  t = 1000;
  expect(rl.hit('ip')).toBe(true);
});

it('bounds the number of tracked keys', () => {
  const rl = createRateLimiter(1, 1000, () => 0, 2);
  rl.hit('a'); rl.hit('b'); rl.hit('c');
  expect(rl.hit('a')).toBe(true);
});
