import type { ExecutorState, HeavyJob } from '../../../../shared/heavy-job';
import { bots } from '../meetings/meetings.fixtures';

export { bots };

export const executor = (over: Partial<ExecutorState> = {}): ExecutorState => ({ configured: true, label: 'PC do Samuel', online: true, checkedAt: 1_000, ...over });

export const job = (over: Partial<HeavyJob> = {}): HeavyJob => ({
  id: 'h1', repo: 'org/app', branch: 'feat/x', command: 'npm test', requestedBy: 'human', status: 'queued', tail: '', createdAt: 10, ...over,
});
