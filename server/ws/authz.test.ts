import { describe, it, expect } from 'vitest';
import { authorize } from './authz';

describe('authorize', () => {
  it('admin may send every message type', () => {
    for (const t of ['send', 'stop', 'admin-health', 'term-open', 'term-input', 'purge', 'set-meta', 'list-archived'] as const) {
      expect(authorize('admin', t)).toBe(true);
    }
  });

  it('student may read and drive own chat', () => {
    for (const t of ['send', 'stop', 'list', 'open', 'open-full', 'search', 'ctx-list', 'ctx-open', 'skill-list', 'skill-open', 'usage-list', 'upload'] as const) {
      expect(authorize('student', t)).toBe(true);
    }
  });

  it('student is denied shell, admin recon, and others’ session mutations', () => {
    for (const t of ['admin-health', 'term-open', 'term-input', 'term-resize', 'term-detach', 'term-close', 'term-list', 'hide', 'unhide', 'purge', 'set-meta', 'list-archived'] as const) {
      expect(authorize('student', t)).toBe(false);
    }
  });

  it('default-deny: an unknown future message type is denied for student', () => {
    expect(authorize('student', 'totally-new-msg' as never)).toBe(false);
    expect(authorize('admin', 'totally-new-msg' as never)).toBe(true);
  });
});
