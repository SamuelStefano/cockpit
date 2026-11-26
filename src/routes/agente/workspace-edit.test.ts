import { describe, expect, it } from 'vitest';
import { CONFLICT_COPY, isEditablePath, newFilePath, saveErrorCopy } from './workspace-edit';

describe('workspace-edit', () => {
  it('edits text files only, never dot paths', () => {
    expect(isEditablePath('CLAUDE.md')).toBe(true);
    expect(isEditablePath('skills/x/SKILL.md')).toBe(true);
    expect(isEditablePath('settings.json')).toBe(true);
    expect(isEditablePath('mock/tela.png')).toBe(false);
    expect(isEditablePath('.claude/settings.json')).toBe(false);
    expect(isEditablePath('a/../b.md')).toBe(false);
  });

  it('normalizes a new file name to .md', () => {
    expect(newFilePath(' notas ')).toBe('notas.md');
    expect(newFilePath('docs/plano.md')).toBe('docs/plano.md');
    expect(newFilePath('')).toBeNull();
    expect(newFilePath('../x')).toBeNull();
  });

  it('maps conflito to the Portuguese copy', () => {
    expect(saveErrorCopy('conflito')).toBe(CONFLICT_COPY);
    expect(saveErrorCopy('outro')).toBe('outro');
  });
});
