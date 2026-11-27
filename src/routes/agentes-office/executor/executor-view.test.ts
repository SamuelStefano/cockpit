import { describe, expect, it } from 'vitest';
import type { ExecutorState, HeavyJob } from '../../../../shared/heavy-job';
import { checkedAgo, executorChip, formBlock, formatDuration, jobDuration, queuedCount, stalledMinutes, stateLabel, submitBlock, toInput } from './executor-view';

const ex = (over: Partial<ExecutorState> = {}): ExecutorState => ({ configured: true, label: 'PC', online: true, ...over });
const job = (status: HeavyJob['status']): HeavyJob => ({ id: status, repo: 'r', branch: 'b', command: 'c', requestedBy: 'human', status, tail: '', createdAt: 1 });

describe('formatDuration', () => {
  it.each([[4_000, '4s'], [65_000, '1min 05s'], [3_660_000, '1h 01min'], [-5, '0s']])('%i ms is %s', (ms, out) => {
    expect(formatDuration(ms)).toBe(out);
  });
  it('is null before the job starts and counts to now while running', () => {
    expect(jobDuration({}, 10)).toBeNull();
    expect(jobDuration({ startedAt: 1_000 }, 4_000)).toBe('3s');
    expect(jobDuration({ startedAt: 1_000, endedAt: 2_000 }, 99_000)).toBe('1s');
  });
});

describe('stall and check time', () => {
  it('counts whole minutes, at least one', () => {
    expect(stalledMinutes(ex(), 5)).toBeNull();
    expect(stalledMinutes(ex({ stalledSince: 0 }), 30_000)).toBe(1);
    expect(stalledMinutes(ex({ stalledSince: 0 }), 12 * 60_000)).toBe(12);
  });
  it('reports the last check', () => {
    expect(checkedAgo(ex(), 5)).toBeNull();
    expect(checkedAgo(ex({ checkedAt: 0 }), 5_000)).toBe('verificado agora há pouco');
    expect(checkedAgo(ex({ checkedAt: 0 }), 5 * 60_000)).toBe('verificado há 5 min');
  });
});

describe('executorChip', () => {
  it('does not exist unless configured', () => {
    expect(executorChip(undefined)).toBeNull();
    expect(executorChip({ configured: false, label: '', online: null })).toBeNull();
  });
  it('shows the label with online or offline and the queue size', () => {
    expect(executorChip(ex())).toBe('PC online');
    expect(executorChip(ex({ online: false }), [job('queued'), job('running'), job('done')])).toBe('PC offline · 2 na fila');
    expect(executorChip(ex({ online: null }))).toBe('PC');
    expect(queuedCount([job('done'), job('failed')])).toBe(0);
  });
  it('labels every state', () => {
    expect(stateLabel(ex())).toBe('online');
    expect(stateLabel(ex({ online: false }))).toBe('offline');
    expect(stateLabel(ex({ online: null }))).toBe('sem verificação');
    expect(stateLabel({ configured: false, label: '', online: null })).toBe('não configurado');
  });
});

describe('form rules', () => {
  it('blocks non-admins first, then an unconfigured executor', () => {
    expect(formBlock(false, false)).toContain('admin');
    expect(formBlock(true, false)).toContain('não está configurado');
    expect(formBlock(true, true)).toBeNull();
  });
  it('asks for the missing field and trims the input', () => {
    expect(submitBlock({ repo: '', branch: 'b', dir: '', command: 'c' })).toContain('repositório');
    expect(submitBlock({ repo: 'r', branch: ' ', dir: '', command: 'c' })).toContain('branch');
    expect(submitBlock({ repo: 'r', branch: 'b', dir: '', command: '' })).toContain('comando');
    expect(submitBlock({ repo: 'r', branch: 'b', dir: '', command: 'c' })).toBeNull();
    expect(toInput({ repo: ' r ', branch: 'b', dir: ' ', command: ' c ' })).toEqual({ repo: 'r', branch: 'b', command: 'c' });
    expect(toInput({ repo: 'r', branch: 'b', dir: 'web', command: 'c' }).dir).toBe('web');
  });
});
