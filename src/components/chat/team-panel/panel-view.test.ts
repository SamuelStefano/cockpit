import { describe, expect, it } from 'vitest';
import type { TeamPanel } from '../../../../shared/team-panel';
import { redactTeamPanel } from '../../../../shared/team-panel';
import { toPanelView } from './panel-view';

const HOUR = 3_600_000;
const panel: TeamPanel = {
  redacted: false, at: 10 * HOUR,
  needsYou: [{ kind: 'blocker', botId: 'a', botName: 'Ana', text: 'Checks failing: o/r#1 T', at: 5 * HOUR }],
  sectors: [{
    id: 'engineering', name: 'Engenharia', openPrs: [], mergedPrs: [],
    bots: [
      { id: 'a', name: 'Ana', status: 'waiting', task: 'Fix login', mascot: { shape: 'drop', color: '#fff' }, openPrs: [], mergedPrs: [], needs: [{ kind: 'blocker', botId: 'a', botName: 'Ana', text: 'Checks failing: o/r#1 T' }] },
      { id: 'b', name: 'Bob', status: 'idle', openPrs: [], mergedPrs: [], needs: [] },
    ],
  }],
};

describe('toPanelView', () => {
  it('maps text, ages and counts in normal mode', () => {
    const v = toPanelView(panel);
    expect(v.needs[0]).toMatchObject({ id: 'a', ageHours: 5, status: 'waiting', line: 'Checks failing: o/r#1 T' });
    expect(v.sectors[0].bots.map((b) => b.line)).toEqual(['Fix login', 'Ociosa']);
    expect(v.sectors[0].blocker).toBe('Ana: Checks failing: o/r#1 T');
  });
  it('has no free text in recording mode', () => {
    const v = toPanelView(redactTeamPanel(panel));
    expect(v.needs[0]).toMatchObject({ name: 'Ana', line: null, status: 'waiting' });
    expect(v.sectors[0].bots.every((b) => b.line === null && b.id === undefined)).toBe(true);
    expect(v.sectors[0].blocker).toBeNull();
  });
});
