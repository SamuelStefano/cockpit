import { CONFIG } from '../config';

// Strips everything Claude Code loads by default that a text-only one-shot never
// uses: built-in tool defs (~27k tokens), the skills listing, user settings
// (hooks, CLAUDE.md, auto-memory) and the transcript on disk.
export const LEAN_ONESHOT_ARGS: readonly string[] = [
  '--tools', '',
  '--disable-slash-commands',
  '--setting-sources', '',
  '--no-session-persistence',
];

export function leanOneShotArgs(systemPrompt: string, on = CONFIG.leanOneShots): string[] {
  return on ? [...LEAN_ONESHOT_ARGS, '--system-prompt', systemPrompt] : [];
}
