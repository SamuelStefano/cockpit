import { describe, it, expect } from 'vitest';
import { createIncidentScheduler, MAX_MANUAL_PER_HOUR, MAX_PER_HOUR, PERSIST_MS, REPEAT_MS } from './incidentScheduler';

describe('incident scheduler', () => {
  it('reports only after the failure persisted 20 s, then every 5 min while it lasts', () => {
    const s = createIncidentScheduler();
    let t = 0;
    expect(s.tick('relay-unreachable', t).send).toBe(false);
    t += PERSIST_MS - 1;
    expect(s.tick('relay-unreachable', t).send).toBe(false);
    t += 1;
    expect(s.tick('relay-unreachable', t)).toEqual({ send: true, repeat: 0 });
    t += REPEAT_MS - 1;
    expect(s.tick('relay-unreachable', t).send).toBe(false);
    t += 1;
    expect(s.tick('relay-unreachable', t)).toEqual({ send: true, repeat: 1 });
  });

  it('forgets an incident that ended before 20 s', () => {
    const s = createIncidentScheduler();
    s.tick('box-offline', 0);
    s.tick(null, 10_000);
    expect(s.tick('box-offline', 25_000).send).toBe(false);
    expect(s.tick('box-offline', 45_000).send).toBe(true);
  });

  it('a new cause is a new incident', () => {
    const s = createIncidentScheduler();
    s.tick('relay-unreachable', 0);
    expect(s.tick('relay-unreachable', PERSIST_MS).send).toBe(true);
    expect(s.tick('box-offline', PERSIST_MS + 1).send).toBe(false);
    expect(s.tick('box-offline', 2 * PERSIST_MS + 1).send).toBe(true);
  });

  it('sends immediate incidents at once', () => {
    const s = createIncidentScheduler();
    expect(s.tick('login-refused', 0, true).send).toBe(true);
  });

  it(`caps automatic reports at ${MAX_PER_HOUR} per hour, one-offs included`, () => {
    const s = createIncidentScheduler({ repeatMs: 1000 });
    let n = 0;
    for (let t = PERSIST_MS; t < PERSIST_MS + 60_000; t += 1000) if (s.tick('x', t, true).send) n++;
    expect(n).toBe(MAX_PER_HOUR);
    expect(s.once('js:boom', 70_000)).toBe(false);
    expect(s.tick('x', PERSIST_MS + 3600_000, true).send).toBe(true);
  });

  it('the button has its own hourly budget', () => {
    const s = createIncidentScheduler({ repeatMs: 1 });
    for (let t = 0; t < 10; t++) s.tick('x', t, true);
    let n = 0;
    for (let t = 0; t < 20; t++) if (s.manual(100 + t)) n++;
    expect(n).toBe(MAX_MANUAL_PER_HOUR);
  });

  it('reports a given one-off only once', () => {
    const s = createIncidentScheduler();
    expect(s.once('js:boom', 0)).toBe(true);
    expect(s.once('js:boom', 1)).toBe(false);
    expect(s.once('js:other', 2)).toBe(true);
  });
});
