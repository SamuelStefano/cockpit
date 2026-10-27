// The API refuses a model when the CLI that calls it is too old, e.g.
// "API Error: 400 Claude Code 2.1.197 does not support this model; version 2.1.280
// or newer is required". Matched only together with a Claude Code / this-model
// anchor, so "Node.js version 18 or newer is required" never triggers an update.
const ANCHORED = [
  /does not support this model[;,.:]?\s*(?:please\s+)?(?:update\s+to\s+)?(?:version\s+)?v?\d+\.\d+\.\d+\s+or\s+(?:newer|later|higher)/i,
  /requires?\s+(?:a\s+)?(?:newer|more recent)\s+version\s+of\s+Claude Code/i,
  /Claude Code\s+(?:v?\d+\.\d+\.\d+\s+)?(?:requires?|needs?)\s+(?:an?\s+)?(?:update|newer version)/i,
  /Claude Code\s+(?:v?\d+\.\d+\.\d+\s+)?is\s+(?:no longer supported|too old|outdated|out of date)/i,
  /(?:update|upgrade)\s+Claude Code\s+to\s+(?:version\s+)?v?\d+\.\d+\.\d+/i,
  /requires?\s+Claude Code\s+(?:version\s+)?v?\d+\.\d+\.\d+\s+or\s+(?:newer|later|higher)/i,
];
const REQUIRED = [
  /version\s+v?(\d+\.\d+\.\d+)\s+or\s+(?:newer|later|higher)/i,
  /(?:update|upgrade)\s+(?:Claude Code\s+)?to\s+(?:version\s+)?v?(\d+\.\d+\.\d+)/i,
  /Claude Code\s+(?:version\s+)?v?(\d+\.\d+\.\d+)\s+or\s+(?:newer|later|higher)/i,
];
// A bailout is one short line; a long text quoting the phrase is an answer about it.
const MAX_CHARS = 1500;

export interface CliTooOld { required: string | null }

export function parseCliTooOld(text: string): CliTooOld | null {
  const t = text.trim();
  if (!t || t.length > MAX_CHARS) return null;
  if (!ANCHORED.some((re) => re.test(t))) return null;
  for (const re of REQUIRED) {
    const m = re.exec(t);
    if (m) return { required: m[1] };
  }
  return { required: null };
}
