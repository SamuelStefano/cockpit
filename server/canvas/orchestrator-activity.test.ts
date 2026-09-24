import { describe, it, expect } from 'vitest';
import { groupDelegatedShells, otherRawShells } from './orchestrator-activity';

describe('groupDelegatedShells', () => {
  const previews = { 'a.prompt.md': 'faz X', 'a.report.md': 'fez X', 'b.prompt.md': 'faz Y' };
  const read = (map: Record<string, string>) => (name: string, ext: string) => map[`${name}.${ext}`];

  it('a name with only .prompt.md is running', () => {
    const rows = groupDelegatedShells(['b.prompt.md'], new Set(), () => 'faz Y', () => undefined);
    expect(rows).toEqual([{ name: 'b', status: 'running', promptPreview: 'faz Y', reportPreview: undefined, tmuxAlive: false, startedAt: undefined }]);
  });

  it('a name with both files is reported', () => {
    const rows = groupDelegatedShells(
      ['a.prompt.md', 'a.report.md'], new Set(),
      (n) => previews[`${n}.prompt.md` as keyof typeof previews],
      (n) => previews[`${n}.report.md` as keyof typeof previews],
    );
    expect(rows).toEqual([{ name: 'a', status: 'reported', promptPreview: 'faz X', reportPreview: 'fez X', tmuxAlive: false, startedAt: undefined }]);
  });

  it('tmuxAlive is true only when cv-<name> is in the live set', () => {
    const rows = groupDelegatedShells(['a.prompt.md'], new Set(['cv-a', 'cv-other']), () => undefined, () => undefined);
    expect(rows[0].tmuxAlive).toBe(true);
  });

  it('threads startedAt through from the prompt-file mtime reader', () => {
    const rows = groupDelegatedShells(['a.prompt.md'], new Set(), () => undefined, () => undefined, () => 12345);
    expect(rows[0].startedAt).toBe(12345);
  });

  it('running rows sort before reported, alphabetically within each group', () => {
    const rows = groupDelegatedShells(
      ['z.prompt.md', 'a.prompt.md', 'a.report.md', 'm.prompt.md'], new Set(),
      () => undefined, () => undefined,
    );
    expect(rows.map((r) => r.name)).toEqual(['m', 'z', 'a']);
  });

  it('a lone .report.md with no matching .prompt.md still produces a reported row', () => {
    const rows = groupDelegatedShells(['orphan.report.md'], new Set(), () => undefined, () => 'fez algo');
    expect(rows).toEqual([{ name: 'orphan', status: 'reported', promptPreview: undefined, reportPreview: 'fez algo', tmuxAlive: false, startedAt: undefined }]);
  });

  it('ignores unrelated files in the same directory', () => {
    const rows = groupDelegatedShells(['README.md', 'notes.txt'], new Set(), () => undefined, () => undefined);
    expect(rows).toEqual([]);
  });
});

describe('otherRawShells', () => {
  it('excludes the Orchestrator\'s own shell id', () => {
    expect(otherRawShells(['cv-self', 'cv-other'], 'cv-self', [])).toEqual(['cv-other']);
  });

  it('excludes ids already accounted for by a delegated shell', () => {
    const delegated = [{ name: 'task1', status: 'running' as const, tmuxAlive: true }];
    expect(otherRawShells(['cv-self', 'cv-task1', 'cv-raw'], 'cv-self', delegated)).toEqual(['cv-raw']);
  });

  it('ignores non-shell ids (w- watch panes, plain term ids)', () => {
    expect(otherRawShells(['cv-self', 'w-abc123', 'main'], 'cv-self', [])).toEqual([]);
  });

  it('empty when nothing else is live', () => {
    expect(otherRawShells(['cv-self'], 'cv-self', [])).toEqual([]);
  });
});
