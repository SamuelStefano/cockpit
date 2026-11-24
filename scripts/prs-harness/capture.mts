// Writes fixture.json (gitignored: it holds the box owner's real PRs) for main.tsx.
//   npx tsx scripts/prs-harness/capture.mts <session-id> [pr-url...]
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getPrDiff } from '../../server/github/pr-diff';
import { getPrDetail, getPrsSnapshot } from '../../server/github/prs';
import { getSessionPrs } from '../../server/github/session-prs';

async function main() {
  const [sessionId, ...urls] = process.argv.slice(2);
  const snapshot = await getPrsSnapshot();
  const session = await getSessionPrs(sessionId, true);
  const pick = [...new Set([...urls, ...(session.prs ?? []).map((p) => p.url), ...snapshot.mine.slice(0, 3).map((p) => p.url)])];
  const frames: unknown[] = [{ t: 'prs', snapshot }, { t: 'prs-session', session }];
  for (const url of pick) {
    const [d, f] = await Promise.all([getPrDetail(url), getPrDiff(url)]);
    frames.push({ t: 'prs-detail', url, detail: d.detail, error: d.error }, { t: 'prs-diff', url, diff: f.diff, error: f.error });
  }
  writeFileSync(join(import.meta.dirname, 'fixture.json'), JSON.stringify({ sessionId, frames }));
  console.log(`fixture: ${pick.length} PRs, session ${session.createdUrls.length}+${session.mentionedUrls.length}`);
  process.exit(0);
}
void main();
