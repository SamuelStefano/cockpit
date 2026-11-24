import { describe, it, expect, vi } from 'vitest';
import type { BootFs } from './self-update-boot';
import { captureErrors, diagFrame, errorsFile, noteBoot, noteCleanExit, pendingFile, runningFile, takePending, writePending } from './agent-diag';
import { AGENT_DIAG_LINES } from '../shared/diag';

const DIR = '/agent';
function memFs() {
  const files = new Map<string, string>();
  const fs: BootFs = { read: (f) => files.get(f) ?? null, write: (f, d) => { files.set(f, d); }, remove: (f) => { files.delete(f); } };
  return { fs, files };
}

describe('agent diag reports', () => {
  it('reports a rolled-back self-update with the last error lines, redacted', () => {
    const { fs, files } = memFs();
    files.set(errorsFile(DIR), JSON.stringify(['boom bearer.abcdefghijklmnopqrstu']));
    noteBoot(fs, DIR, 'rolled-back');
    expect(takePending(fs, DIR)).toEqual({ kind: 'self-update-rollback', lines: ['boom bearer.[token]'] });
    expect(files.has(pendingFile(DIR))).toBe(false);
  });

  it('reports an unclean exit only when the running marker was left behind', () => {
    const { fs } = memFs();
    noteBoot(fs, DIR, 'none');
    expect(takePending(fs, DIR)).toBeNull();
    noteBoot(fs, DIR, 'none');
    expect(takePending(fs, DIR)?.kind).toBe('unclean-exit');
    noteCleanExit(fs, DIR);
    noteBoot(fs, DIR, 'none');
    expect(takePending(fs, DIR)).toBeNull();
  });

  it('keeps a crash report over the unclean-exit one', () => {
    const { fs, files } = memFs();
    files.set(runningFile(DIR), '1');
    writePending(fs, DIR, 'crash', ['Error: x']);
    noteBoot(fs, DIR, 'none');
    expect(takePending(fs, DIR)).toEqual({ kind: 'crash', lines: ['Error: x'] });
  });

  it('captures console.error into a bounded ring mirrored to disk', () => {
    vi.useFakeTimers();
    const { fs, files } = memFs();
    const target = { error: (..._a: unknown[]) => {} };
    const cap = captureErrors(fs, DIR, target, 100);
    for (let i = 0; i < AGENT_DIAG_LINES + 5; i++) target.error('err', i);
    expect(cap.lines()).toHaveLength(AGENT_DIAG_LINES);
    expect(files.has(errorsFile(DIR))).toBe(false);
    vi.advanceTimersByTime(100);
    expect(JSON.parse(files.get(errorsFile(DIR))!)).toHaveLength(AGENT_DIAG_LINES);
    vi.useRealTimers();
  });

  it('ignores a corrupt or hostile pending file', () => {
    const { fs, files } = memFs();
    files.set(pendingFile(DIR), '{"kind":"DROP TABLE","lines":[]}');
    expect(takePending(fs, DIR)).toBeNull();
    files.set(pendingFile(DIR), 'not json');
    expect(takePending(fs, DIR)).toBeNull();
  });

  it('builds the relay frame', () => {
    expect(JSON.parse(diagFrame({ kind: 'crash', lines: ['a'] }, 'abc1234'))).toEqual({ t: 'diag-report', kind: 'crash', lines: ['a'], version: 'abc1234' });
  });
});
