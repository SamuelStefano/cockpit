import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readOrchestrator, readOrchestratorSync, isTmuxAliveSync } from './orchestrator';

const dir = mkdtempSync(join(tmpdir(), 'cockpit-orchestrator-'));
const file = join(dir, 'orchestrator.json');
process.env.COCKPIT_ORCHESTRATOR = file;

afterEach(() => rmSync(file, { force: true }));

describe('readOrchestrator', () => {
  it('returns undefined when the file is missing', async () => {
    expect(await readOrchestrator()).toBeUndefined();
  });

  it('returns undefined on invalid JSON', async () => {
    writeFileSync(file, '{not json');
    expect(await readOrchestrator()).toBeUndefined();
  });

  it('returns undefined when a required field is missing or empty', async () => {
    writeFileSync(file, JSON.stringify({ name: 'Orchestrator', sessionId: '', tmux: 'cockpit-cv-x' }));
    expect(await readOrchestrator()).toBeUndefined();
    writeFileSync(file, JSON.stringify({ name: 'Orchestrator', tmux: 'cockpit-cv-x' }));
    expect(await readOrchestrator()).toBeUndefined();
  });

  it('reads name/sessionId/tmux and drops extra fields', async () => {
    writeFileSync(file, JSON.stringify({
      name: 'Orchestrator', sessionId: '7671f68f-bd1b-4a8d-ab24-a122583c2286', tmux: 'cockpit-cv-jmbp6v', since: '2026-09-24',
    }));
    expect(await readOrchestrator()).toEqual({
      name: 'Orchestrator', sessionId: '7671f68f-bd1b-4a8d-ab24-a122583c2286', tmux: 'cockpit-cv-jmbp6v',
    });
  });
});

describe('readOrchestratorSync', () => {
  it('mirrors readOrchestrator — same validation, blocking read', () => {
    expect(readOrchestratorSync()).toBeUndefined();
    writeFileSync(file, JSON.stringify({ name: 'Orchestrator', sessionId: 'abc', tmux: 'cockpit-cv-x' }));
    expect(readOrchestratorSync()).toEqual({ name: 'Orchestrator', sessionId: 'abc', tmux: 'cockpit-cv-x' });
  });
});

describe('isTmuxAliveSync', () => {
  const name = `cockpit-orchestrator-test-${process.pid}`;
  afterEach(() => { try { execFileSync('tmux', ['kill-session', '-t', name]); } catch { /* already gone */ } });

  it('is false for a session that was never created', () => {
    expect(isTmuxAliveSync(`${name}-nope`)).toBe(false);
  });

  it('is true for a live tmux session and false again once it is killed', () => {
    execFileSync('tmux', ['new-session', '-d', '-s', name]);
    expect(isTmuxAliveSync(name)).toBe(true);
    execFileSync('tmux', ['kill-session', '-t', name]);
    expect(isTmuxAliveSync(name)).toBe(false);
  });
});
