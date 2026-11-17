import { describe, expect, it } from 'vitest';
import { botDetail, needDetail, prDetail } from './panel-detail';

const pr = { url: 'https://github.com/o/r/pull/3', number: 3, title: 'T', repo: 'o/r', branch: 'b', state: 'open' as const, blocker: 'checks' as const };

describe('panel-detail', () => {
  it('lists task, PRs and needs for a bot', () => {
    const d = botDetail({ id: 'a', name: 'Ana', status: 'working', task: 'X', openPrs: [pr], mergedPrs: [], needs: [] });
    expect(d.lines).toEqual(['Task: X', 'Open: o/r#3 T (checks failing)']);
  });
  it('titles questions and blockers differently and keeps the PR link', () => {
    expect(needDetail({ kind: 'question', botName: 'Ana', text: 'q' }).title).toBe('Ana asks');
    expect(needDetail({ kind: 'blocker', botName: 'Ana', text: 'b', prUrl: pr.url }).link).toBe(pr.url);
    expect(prDetail(pr).link).toBe(pr.url);
  });
});
