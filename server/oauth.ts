import { homedir } from 'node:os';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';

// Token OAuth do CLA (login do Claude Code), lido fresh a cada uso pra pegar o
// refresh que o CLI faz sozinho. SEGURANÇA: o token nunca sai do servidor — só
// vira header de chamadas server-side pra API da Anthropic.
export async function readOAuthToken(): Promise<string | null> {
  try {
    const raw = await readFile(join(homedir(), '.claude', '.credentials.json'), 'utf8');
    const tok = JSON.parse(raw)?.claudeAiOauth?.accessToken;
    return typeof tok === 'string' && tok ? tok : null;
  } catch { return null; }
}

export const OAUTH_BETA = 'oauth-2025-04-20';
