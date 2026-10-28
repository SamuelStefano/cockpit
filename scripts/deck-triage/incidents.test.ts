import { describe, expect, it } from 'vitest';
import type { DiagReport } from '../../ops/src/data.ts';
import { createIncidentTracker } from './incidents.ts';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
let n = 0;
const rep = (account: string, kind: string, at: string): DiagReport => ({
  id: `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`, created_at: at, account_id: account, source: 'browser', kind, box_id: null, app_version: null, user_agent: null, payload: {},
});

describe('createIncidentTracker', () => {
  it('groups same kind + account within 15 min into one incident', () => {
    const t = createIncidentTracker();
    const { opened, folded } = t.ingest([
      rep(A, 'relay-unreachable', '2026-10-28T15:00:00Z'),
      rep(A, 'relay-unreachable', '2026-10-28T15:10:00Z'),
      rep(A, 'relay-unreachable', '2026-10-28T15:24:00Z'),
    ]);
    expect(opened).toHaveLength(1);
    expect(opened[0].count).toBe(3);
    expect(folded).toBe(0);
  });

  it('splits by account, by kind and after a 15 min gap', () => {
    const t = createIncidentTracker();
    const { opened } = t.ingest([
      rep(A, 'relay-unreachable', '2026-10-28T15:00:00Z'),
      rep(B, 'relay-unreachable', '2026-10-28T15:01:00Z'),
      rep(A, 'login-refused', '2026-10-28T15:02:00Z'),
      rep(A, 'relay-unreachable', '2026-10-28T15:30:00Z'),
    ]);
    expect(opened.map((i) => `${i.accountId.slice(0, 1)}:${i.kind}`)).toEqual(['1:relay-unreachable', '2:relay-unreachable', '1:login-refused', '1:relay-unreachable']);
  });

  it('folds a later tick into the incident already open', () => {
    const t = createIncidentTracker();
    const [inc] = t.ingest([rep(A, 'box-offline', '2026-10-28T15:00:00Z')]).opened;
    t.escalate(inc);
    const second = t.ingest([rep(A, 'box-offline', '2026-10-28T15:05:00Z')]);
    expect(second).toEqual({ opened: [], folded: 1 });
    expect(inc.count).toBe(2);
    expect(t.pending()).toHaveLength(0);
  });

  it('sorts out-of-order rows before grouping', () => {
    const t = createIncidentTracker();
    const { opened } = t.ingest([rep(A, 'js-error', '2026-10-28T15:10:00Z'), rep(A, 'js-error', '2026-10-28T15:00:00Z')]);
    expect(opened).toHaveLength(1);
    expect(opened[0].lastAt - opened[0].firstAt).toBe(10 * 60_000);
  });

  it('closes quiet incidents on prune', () => {
    const t = createIncidentTracker();
    t.ingest([rep(A, 'js-error', '2026-10-28T15:00:00Z')]);
    expect(t.prune(Date.parse('2026-10-28T15:10:00Z'))).toHaveLength(0);
    expect(t.prune(Date.parse('2026-10-28T15:16:00Z'))).toHaveLength(1);
    expect(t.all()).toHaveLength(0);
  });
});
