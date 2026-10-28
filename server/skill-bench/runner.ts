import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { cliPath } from '../engine/cli-path';
import type { Runner } from './types';

const CWD = join(homedir(), '.cockpit', 'oneshot');

export function claudeArgs(prompt: string, systemPrompt: string | null, model: string): string[] {
  return [
    '-p', prompt, '--model', model, '--effort', 'low', '--output-format', 'json',
    '--tools', '', '--disable-slash-commands', '--setting-sources', '', '--strict-mcp-config', '--no-session-persistence',
    ...(systemPrompt ? ['--append-system-prompt', systemPrompt] : []),
  ];
}

export function claudeRunner(model = 'haiku', timeoutMs = 120_000): Runner {
  try { mkdirSync(CWD, { recursive: true }); } catch { /* best effort */ }
  return (prompt, systemPrompt) => new Promise((resolve, reject) => {
    const child = spawn('claude', claudeArgs(prompt, systemPrompt, model), {
      cwd: CWD, env: { PATH: cliPath(), HOME: process.env.HOME, LANG: 'en_US.UTF-8', TERM: 'dumb' },
      shell: false, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout!.on('data', (d) => { out += String(d); });
    const kill = () => { try { if (child.pid) process.kill(-child.pid, 'SIGKILL'); } catch { /* gone */ } };
    const timer = setTimeout(() => { kill(); reject(new Error('timeout')); }, timeoutMs);
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', () => {
      clearTimeout(timer);
      try {
        const o = JSON.parse(out) as { result?: unknown; is_error?: boolean };
        if (typeof o.result !== 'string' || o.is_error) reject(new Error(String(o.result ?? 'empty result')));
        else resolve(o.result);
      } catch { reject(new Error('claude returned non-JSON output')); }
    });
  });
}
