import { describe, it, expect } from 'vitest';
import { authorize } from './authz';
import { ROOT_ONLY } from '../../shared/root-frames';

describe('authorize', () => {
  it('admin may send every message type', () => {
    for (const t of ['send', 'stop', 'admin-health', 'term-open', 'term-input', 'purge', 'set-meta', 'list-archived'] as const) {
      expect(authorize('admin', t)).toBe(true);
    }
  });

  it('student may read and drive own chat', () => {
    for (const t of ['send', 'stop', 'list', 'open', 'open-full', 'search', 'ctx-list', 'ctx-open', 'skill-list', 'skill-open', 'usage-list', 'upload-chunk', 'orchestrator-get'] as const) {
      expect(authorize('student', t)).toBe(true);
    }
  });

  it('student is denied shell, admin recon, and others’ session mutations', () => {
    for (const t of ['admin-health', 'term-open', 'term-input', 'term-resize', 'term-detach', 'term-close', 'term-list', 'hide', 'unhide', 'purge', 'set-meta', 'list-archived', 'orchestrator-activity-get', 'canvas-session-peek'] as const) {
      expect(authorize('student', t)).toBe(false);
    }
  });

  it('student mexe na PRÓPRIA fila (add/remove/edit/move/clear)', () => {
    for (const t of ['queue-add', 'queue-remove', 'queue-edit', 'queue-move', 'queue-clear', 'queue-get'] as const) {
      expect(authorize('student', t)).toBe(true);
    }
  });

  it('student reads its own bots files (team-files-get/team-file-get)', () => {
    expect(authorize('student', 'team-files-get')).toBe(true);
    expect(authorize('student', 'team-file-get')).toBe(true);
  });

  it('student may poll grok usage like Claude, and read computer counts', () => {
    expect(authorize('student', 'grok-usage-get')).toBe(true);
    expect(authorize('student', 'plan-usage-get')).toBe(true);
    expect(authorize('student', 'team-computer-get')).toBe(true);
    expect(authorize('student', 'term-open')).toBe(false);
  });

  it('student may log the box Claude CLI in', () => {
    for (const t of ['claude-login-start', 'claude-login-code', 'claude-login-cancel'] as const) {
      expect(authorize('student', t)).toBe(true);
    }
  });

  it('default-deny: an unknown future message type is denied for student', () => {
    expect(authorize('student', 'totally-new-msg' as never)).toBe(false);
    expect(authorize('admin', 'totally-new-msg' as never)).toBe(true);
  });

  it('drop privado é admin-only: student negado nos 4 frames', () => {
    for (const t of ['drop-put', 'drop-list', 'drop-open', 'drop-rm'] as const) {
      expect(authorize('student', t)).toBe(false);
      expect(authorize('admin', t)).toBe(true);
    }
  });

  it('canvas é admin-only: o grafo expõe toda a memória e o card dispara agente', () => {
    for (const t of ['canvas-get', 'canvas-pos', 'canvas-pos-reset', 'canvas-card-save', 'canvas-card-delete'] as const) {
      expect(authorize('student', t)).toBe(false);
      expect(authorize('admin', t)).toBe(true);
    }
  });

  // Kanban triage (canvas review item 2): same admin-only surface as
  // canvas-session-status — default-deny means a new `t` needs no allowlist
  // entry to stay blocked, this just documents the intent.
  it('kanban triage/hide frames são admin-only, igual canvas-session-status', () => {
    for (const t of ['canvas-session-status', 'canvas-session-status-bulk', 'canvas-session-hide', 'canvas-session-unhide-all'] as const) {
      expect(authorize('student', t)).toBe(false);
      expect(authorize('admin', t)).toBe(true);
    }
  });

  it('financeiro DFL é root-only: student e admin negados, dono liberado', () => {
    for (const t of ['points-dfl-get', 'points-dfl-sync'] as const) {
      expect(authorize('student', t)).toBe(false);
      expect(authorize('admin', t)).toBe(false);
      expect(authorize('admin', t, true)).toBe(true);
    }
  });

  it('every owner frame needs root: admin without it is denied, the owner passes', () => {
    const owner = [
      'points-get', 'points-add', 'points-correct', 'points-note', 'points-delete',
      'points-dfl-get', 'points-dfl-sync', 'points-dfl-change', 'points-dfl-invoice',
      'pontos-agent-tasks', 'drafts-get', 'drafts-op',
      'admin-env-set', 'admin-env-unset', 'admin-mcp-add', 'admin-mcp-remove',
      'admin-cli-install', 'admin-cli-update', 'admin-deck-restart',
      'agent-add-custom', 'agent-probe-draft',
    ] as const;
    expect([...ROOT_ONLY].sort()).toEqual([...owner].sort());
    for (const t of owner) {
      expect(authorize('admin', t)).toBe(false);
      expect(authorize('student', t)).toBe(false);
      expect(authorize('student', t, true)).toBe(false);
      expect(authorize('admin', t, true)).toBe(true);
    }
  });

  it('an unlisted future owner frame is denied without root by its prefix', () => {
    expect(authorize('admin', 'points-future' as never)).toBe(false);
    expect(authorize('admin', 'points-future' as never, true)).toBe(true);
  });

  it('a plain admin keeps the rest of the Painel', () => {
    for (const t of ['admin-health', 'agents-get', 'refresh-models', 'canvas-get', 'term-open'] as const) {
      expect(authorize('admin', t)).toBe(true);
    }
  });

  it('student uses the Equipe: team and cron frames pass authz (dispatch coerces them, ws/student-team.ts)', () => {
    for (const t of ['team-get', 'team-save', 'team-delete', 'crons-get', 'cron-save', 'cron-delete', 'cron-run'] as const) {
      expect(authorize('student', t)).toBe(true);
    }
  });
});
