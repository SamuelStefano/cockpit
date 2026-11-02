import { appendFile, readFile, rename, writeFile } from 'node:fs/promises';

export const HISTORY_MAX_LINES = 200;

// Telegram gives a bot no way to read its own past messages, so the bot keeps a copy.
export async function appendBotMessage(path: string, text: string, now: () => Date = () => new Date()): Promise<void> {
  await appendFile(path, `${JSON.stringify({ t: now().toISOString(), text })}\n`, { mode: 0o600 });
}

export async function trimBotMessages(path: string, max = HISTORY_MAX_LINES): Promise<void> {
  const lines = (await readFile(path, 'utf8')).split('\n').filter(Boolean);
  if (lines.length <= max) return;
  await writeFile(`${path}.tmp`, `${lines.slice(-max).join('\n')}\n`, { mode: 0o600 });
  await rename(`${path}.tmp`, path);
}
