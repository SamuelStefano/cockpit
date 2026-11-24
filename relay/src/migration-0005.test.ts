import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(new URL('../../migrations/relay/0005_lock_agent_writes.sql', import.meta.url), 'utf8');

describe('relay migration 0005', () => {
  it('drops the permissive agent and pairing_code write policies', () => {
    expect(sql).toMatch(/drop policy if exists agent_self_all on public\.agent/);
    expect(sql).toMatch(/drop policy if exists pcode_self_insert on public\.pairing_code/);
  });

  it('keeps only a select policy on agent', () => {
    expect(sql).toMatch(/create policy agent_self_read on public\.agent\s+for select/);
    expect(sql).not.toMatch(/create policy \w+ on public\.agent\s+for (all|insert|update|delete)/);
  });

  it('revokes writes from authenticated and everything from anon', () => {
    for (const t of ['agent', 'pairing_code']) {
      expect(sql).toMatch(new RegExp(`revoke insert, update, delete, truncate on public\\.${t}\\s+from authenticated`));
      expect(sql).toMatch(new RegExp(`revoke all on public\\.${t}\\s+from anon`));
    }
  });
});
