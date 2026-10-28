import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { TriageConfig } from './config.ts';
import { run, type Runner } from './exec.ts';
import { SYSTEM_BRIEF } from './diagnose.ts';

// app-security §4: the prompt carries user-written report text, so the model gets zero
// tools (`--tools ''`), no MCP, no settings (the user settings default to bypass), and
// an empty cwd. Verified: with these flags a "read this file" request has no tool to call.
export function claudeArgs(cfg: Pick<TriageConfig, 'model' | 'anthropicKey'>): string[] {
  return [
    '-p',
    ...(cfg.anthropicKey ? ['--bare'] : []),
    '--tools', '',
    '--allowed-tools', '',
    '--permission-mode', 'default',
    '--strict-mcp-config',
    '--setting-sources', '',
    '--model', cfg.model,
    '--max-budget-usd', '0.25',
    '--output-format', 'json',
    '--system-prompt', SYSTEM_BRIEF,
  ];
}

export async function askClaude(cfg: Pick<TriageConfig, 'model' | 'anthropicKey' | 'claudeBin' | 'stateDir'>, prompt: string, runner: Runner = run): Promise<string | null> {
  const cwd = join(cfg.stateDir, 'claude-cwd');
  await mkdir(cwd, { recursive: true });
  const env: NodeJS.ProcessEnv = { ...process.env, CLAUDE_CODE_OAUTH_TOKEN: process.env.CLAUDE_CODE_OAUTH_TOKEN ?? '' };
  if (cfg.anthropicKey) env.ANTHROPIC_API_KEY = cfg.anthropicKey;
  else delete env.ANTHROPIC_API_KEY;
  const res = await runner(cfg.claudeBin, claudeArgs(cfg), { input: prompt, timeoutMs: 120_000, env, cwd });
  if (res.code !== 0) return null;
  try {
    const j = JSON.parse(res.stdout) as { result?: unknown; is_error?: boolean };
    return !j.is_error && typeof j.result === 'string' ? j.result : null;
  } catch { return null; }
}
