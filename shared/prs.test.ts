import { describe, expect, it } from 'vitest';
import { classifyRisk, mergeBlocker, mergeConfirmText, needsMergeConfirm, taskFromBody } from './prs';

const risk = (files: string[], extra: Partial<{ additions: number; deletions: number; filesTruncated: boolean }> = {}) =>
  classifyRisk({ files, filesTruncated: false, additions: 10, deletions: 2, ...extra });

describe('classifyRisk', () => {
  it('flags migrations, SQL, RLS and money paths as unsafe', () => {
    expect(risk(['supabase/migrations/20261107_add.sql'])).toEqual({ risk: 'unsafe', reasons: ['migration', 'SQL'] });
    expect(risk(['db/policies/users.ts']).risk).toBe('unsafe');
    expect(risk(['src/payments/checkout.ts']).reasons).toEqual(['financeiro']);
  });

  it('flags edge functions, CI, auth, env and lockfiles as maybe', () => {
    expect(risk(['supabase/functions/hook/index.ts']).reasons).toEqual(['edge function']);
    expect(risk(['.github/workflows/ci.yml']).reasons).toEqual(['CI']);
    expect(risk(['server/auth.ts']).reasons).toEqual(['auth']);
    expect(risk(['package-lock.json']).reasons).toEqual(['dependências']);
  });

  it('does not read ordinary UI paths as risky', () => {
    expect(risk(['src/components/chrome/sidebar/rail-chats.ts', 'src/routes/Prs.tsx'])).toEqual({ risk: 'safe', reasons: [] });
    expect(risk(['src/components/Author.tsx', 'src/lib/tokenize-markdown.ts']).risk).toBe('safe');
  });

  it('a big diff or an unread file list is maybe, never safe', () => {
    expect(risk(['src/a.ts'], { additions: 900 }).reasons).toEqual(['diff grande']);
    expect(risk(['src/a.ts'], { filesTruncated: true }).risk).toBe('maybe');
  });

  it('unsafe wins over maybe', () => {
    expect(risk(['supabase/functions/x/index.ts', 'supabase/migrations/1.sql']).risk).toBe('unsafe');
  });
});

describe('merge gate helpers', () => {
  it('asks to confirm anything not plainly safe', () => {
    expect(needsMergeConfirm({ risk: 'safe', checks: 'success', isDraft: false })).toBe(false);
    expect(needsMergeConfirm({ risk: 'safe', checks: 'pending', isDraft: false })).toBe(false);
    expect(needsMergeConfirm({ risk: 'maybe', checks: 'success', isDraft: false })).toBe(true);
    expect(needsMergeConfirm({ risk: 'safe', checks: 'failure', isDraft: false })).toBe(true);
    expect(needsMergeConfirm({ risk: 'safe', checks: 'success', isDraft: true })).toBe(true);
  });

  it('blocks closed PRs and conflicts', () => {
    expect(mergeBlocker({ state: 'open', mergeable: 'ok' })).toBeNull();
    expect(mergeBlocker({ state: 'open', mergeable: 'unknown' })).toBeNull();
    expect(mergeBlocker({ state: 'open', mergeable: 'conflict' })).toMatch(/conflito/);
    expect(mergeBlocker({ state: 'merged', mergeable: 'ok' })).toMatch(/aberta/);
  });

  it('confirm text is the short repo ref', () => {
    expect(mergeConfirmText({ repo: 'iterahq/itera-api', number: 412 })).toBe('itera-api#412');
  });

  it('reads the DFL task from the body', () => {
    expect(taskFromBody('Fixes x\n\nTask: dfl-831')).toBe('DFL-831');
    expect(taskFromBody('no task here')).toBeUndefined();
  });
});
