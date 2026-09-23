import { describe, it, expect, beforeEach } from 'vitest';
import { registerFlowRun, clearFlowRun, activeFlowRuns, __resetFlowRuns } from './flow-runs';

beforeEach(() => __resetFlowRuns());

describe('flow-runs', () => {
  it('returns nothing before any run is registered', () => {
    expect(activeFlowRuns()).toEqual([]);
  });

  it('registers a run and reflects it in activeFlowRuns', () => {
    registerFlowRun('new-abc', 'card1', 'flow1');
    expect(activeFlowRuns()).toEqual([{ runKey: 'new-abc', cardId: 'card1', flowId: 'flow1' }]);
  });

  it('tracks multiple concurrent runs', () => {
    registerFlowRun('new-a', 'card1', 'flow1');
    registerFlowRun('new-b', 'card2', 'flow2');
    expect(activeFlowRuns().sort((a, b) => a.runKey.localeCompare(b.runKey))).toEqual([
      { runKey: 'new-a', cardId: 'card1', flowId: 'flow1' },
      { runKey: 'new-b', cardId: 'card2', flowId: 'flow2' },
    ]);
  });

  it('clearFlowRun removes only the matching runKey', () => {
    registerFlowRun('new-a', 'card1', 'flow1');
    registerFlowRun('new-b', 'card2', 'flow2');
    clearFlowRun('new-a');
    expect(activeFlowRuns()).toEqual([{ runKey: 'new-b', cardId: 'card2', flowId: 'flow2' }]);
  });

  it('clearFlowRun on an unknown key is a no-op', () => {
    registerFlowRun('new-a', 'card1', 'flow1');
    clearFlowRun('nope');
    expect(activeFlowRuns()).toEqual([{ runKey: 'new-a', cardId: 'card1', flowId: 'flow1' }]);
  });

  it('a later register for the same runKey overwrites the earlier one', () => {
    registerFlowRun('new-a', 'card1', 'flow1');
    registerFlowRun('new-a', 'card2', 'flow2');
    expect(activeFlowRuns()).toEqual([{ runKey: 'new-a', cardId: 'card2', flowId: 'flow2' }]);
  });
});
