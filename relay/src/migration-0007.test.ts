import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOX_LABEL_MAX } from '../../shared/boxes';

const sql = readFileSync(new URL('../../migrations/relay/0007_agent_label.sql', import.meta.url), 'utf8');

describe('relay migration 0007', () => {
  it('bounds agent.label to the length the relay sanitizes to', () => {
    expect(sql).toContain(`check (char_length(label) <= ${BOX_LABEL_MAX})`);
  });

  it('is re-runnable and changes no policy, grant or function', () => {
    expect(sql).toMatch(/exception when duplicate_object then null/);
    expect(sql).not.toMatch(/\b(policy|grant|revoke|function|security definer)\b/i);
  });
});
