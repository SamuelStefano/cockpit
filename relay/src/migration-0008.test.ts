import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DIAG_PAYLOAD_MAX } from '../../shared/diag';

const sql = readFileSync(new URL('../../migrations/relay/0008_diag_reports.sql', import.meta.url), 'utf8');
const code = sql.replace(/--.*$/gm, '');

describe('relay migration 0008 (diag_reports)', () => {
  it('turns RLS on and lets authenticated users insert only their own browser rows', () => {
    expect(code).toMatch(/alter table public\.diag_reports enable row level security/);
    expect(code).toMatch(/for insert to authenticated\s+with check \(account_id = auth\.uid\(\) and source = 'browser'\)/);
  });

  it('has no select, update, delete or all policy', () => {
    expect(code).not.toMatch(/for (select|update|delete|all)\b/i);
  });

  it('grants authenticated only insert and strips anon', () => {
    expect(code).toMatch(/revoke all on table public\.diag_reports from anon, public;/);
    expect(code).toMatch(/revoke all on table public\.diag_reports from authenticated;/);
    const grants = code.match(/grant [^;]+;/g) ?? [];
    expect(grants).toEqual(['grant insert on table public.diag_reports to authenticated;']);
  });

  it('caps the payload at the size the writers enforce', () => {
    expect(code).toContain(`octet_length(payload::text) <= ${DIAG_PAYLOAD_MAX}`);
    expect(code).toMatch(/source in \('browser', 'agent', 'relay'\)/);
  });

  it('accepts only slug kinds and uuid box ids (they reach an operator terminal)', () => {
    expect(code).toContain("kind ~ '^[a-z][a-z0-9_-]{0,39}$'");
    expect(code).toContain("box_id ~ '^[0-9a-f-]{36}$'");
  });

  it('indexes created_at desc and account_id for the admin app', () => {
    expect(code).toMatch(/on public\.diag_reports \(created_at desc\)/);
    expect(code).toMatch(/on public\.diag_reports \(account_id, created_at desc\)/);
  });

  it('stays thin: no function, trigger or security definer', () => {
    expect(code).not.toMatch(/\b(function|trigger|security definer|plpgsql)\b/i);
  });
});
