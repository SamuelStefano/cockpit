import { describe, it, expect } from 'vitest';
import { sanitizeDrafts, epicStatus, deliveryTasks, legacyDeliveryId } from './dfl-drafts-model';

// Shape of ~/.cockpit/dfl-drafts.json as #585 wrote it: no deliveries, no task status.
const LEGACY = [
  { id: 'ep-212b6e', title: 'Lesson Studio: canvas engine', status: 'draft', createdAt: 10, tasks: [
    { id: 'tk-8375ed', title: 'Keyframe tracks', points: 5, refs: ['LS#577'] },
    { id: 'tk-78f921', title: 'Lane de keyframes', points: 5, refs: ['LS#578'] },
  ] },
  { id: 'ep-a97fe1', title: 'Revera', status: 'dispatched', createdAt: 20, dispatchedAt: 30, tasks: [
    { id: 'tk-1', title: 'Site', points: 2, refs: [] },
  ] },
];

describe('sanitizeDrafts — migration from drafts without deliveries', () => {
  it('loads a legacy epic as one default delivery holding every task, with a stable id', () => {
    const [a] = sanitizeDrafts(LEGACY);
    expect(a.deliveries).toEqual([{ id: 'dl-212b6e', title: 'Lesson Studio: canvas engine // Samuel', taskIds: ['tk-8375ed', 'tk-78f921'] }]);
    expect(sanitizeDrafts(LEGACY)[0].deliveries[0].id).toBe(legacyDeliveryId('ep-212b6e'));
    expect(a.tasks.every((t) => t.status === 'draft')).toBe(true);
  });

  it('tasks of an already dispatched legacy epic inherit its status', () => {
    const [, b] = sanitizeDrafts(LEGACY);
    expect(b).toMatchObject({ status: 'dispatched', dispatchedAt: 30 });
    expect(b.tasks[0].status).toBe('dispatched');
  });

  it('repairs delivery lists: unknown and duplicated ids dropped, orphans go to the first delivery', () => {
    const [d] = sanitizeDrafts([{
      ...LEGACY[0],
      deliveries: [
        { id: 'dl-a', title: 'A', taskIds: ['tk-ghost', 'tk-78f921'] },
        { id: 'dl-b', title: '', taskIds: ['tk-78f921'] },
        { id: 'dl-a', title: 'dup', taskIds: [] },
      ],
    }]);
    expect(d.deliveries).toEqual([
      { id: 'dl-a', title: 'A', taskIds: ['tk-78f921', 'tk-8375ed'] },
      { id: 'dl-b', title: 'Lesson Studio: canvas engine // Samuel', taskIds: [] },
    ]);
    expect(deliveryTasks(d, 'dl-a').map((t) => t.title)).toEqual(['Lane de keyframes', 'Keyframe tracks']);
  });
});

describe('epicStatus', () => {
  const t = (status: 'draft' | 'dispatched' | 'created') => ({ id: status, title: 'x', points: 1, refs: [], status });
  it('is the least advanced task: a half-sent epic is still pending', () => {
    expect(epicStatus([t('created'), t('draft')], 'created')).toBe('draft');
    expect(epicStatus([t('created'), t('dispatched')], 'draft')).toBe('dispatched');
    expect(epicStatus([t('created')], 'draft')).toBe('created');
    expect(epicStatus([], 'dispatched')).toBe('dispatched');
  });
});
