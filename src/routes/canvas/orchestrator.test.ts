import { describe, it, expect } from 'vitest';
import { isOrchestratorNode, orchestratorTermId } from './orchestrator';

const info = { name: 'Orchestrator', sessionId: '7671f68f-bd1b-4a8d-ab24-a122583c2286', tmux: 'cockpit-cv-jmbp6v' };

describe('isOrchestratorNode', () => {
  it('is false with no orchestrator configured', () => {
    expect(isOrchestratorNode({ kind: 'session', ref: info.sessionId }, undefined)).toBe(false);
  });

  it('matches the session by sessionId', () => {
    expect(isOrchestratorNode({ kind: 'session', ref: info.sessionId }, info)).toBe(true);
    expect(isOrchestratorNode({ kind: 'session', ref: 'other' }, info)).toBe(false);
  });

  it('matches the shell by tmux name minus the cockpit- prefix', () => {
    expect(isOrchestratorNode({ kind: 'shell', ref: 'cv-jmbp6v' }, info)).toBe(true);
    expect(isOrchestratorNode({ kind: 'shell', ref: 'cv-other' }, info)).toBe(false);
  });

  it('never matches a context or card node', () => {
    expect(isOrchestratorNode({ kind: 'context', ref: info.sessionId }, info)).toBe(false);
    expect(isOrchestratorNode({ kind: 'card', ref: info.sessionId }, info)).toBe(false);
  });
});

describe('orchestratorTermId', () => {
  it('strips the cockpit- prefix', () => expect(orchestratorTermId(info)).toBe('cv-jmbp6v'));
});
