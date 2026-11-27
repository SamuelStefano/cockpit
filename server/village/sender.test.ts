import { describe, it, expect } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateBotInput } from '../../shared/team';
import { VILLAGE_SENDER } from '../../shared/team-messages';
import { processClaimed } from '../team-outbox';

describe('village system sender', () => {
  it('the outbox accepts it without a team member of that id, and no bot may take the id', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'village-sender-'));
    process.env.COCKPIT_TEAM_LOG = join(dir, 'log.jsonl');
    try {
      const p = join(dir, 'm.json');
      await writeFile(p, JSON.stringify({ id: 'mabcdef12', from: VILLAGE_SENDER, to: 'bob', text: 'task', hop: 1, ts: 1 }));
      const team = [{ id: 'bob', name: 'bob' }] as never;
      const m = await processClaimed(p, { getTeam: async () => team, deliver: async () => 'delivered' });
      expect(m).toMatchObject({ from: 'village', status: 'delivered' });
      await writeFile(p, JSON.stringify({ id: 'mabcdef13', from: 'ghost', to: 'bob', text: 'x', hop: 1, ts: 1 }));
      expect(await processClaimed(p, { getTeam: async () => team, deliver: async () => 'delivered' })).toMatchObject({ status: 'blocked' });
    } finally { delete process.env.COCKPIT_TEAM_LOG; await rm(dir, { recursive: true, force: true }); }
    expect(validateBotInput({ id: 'village', name: 'Vila', mascot: { shape: 'blob', color: '#22c55e' }, profile: 'full' })).toMatchObject({ ok: false });
  });
});
