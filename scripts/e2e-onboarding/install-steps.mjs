import { tail } from './report.mjs';

const SETUP_URL = process.env.DECK_SETUP_URL ?? 'https://raw.githubusercontent.com/SamuelStefano/cockpit/main/scripts/agent-setup.sh';
const ONE_LINER = (env) => `curl -fsSL ${SETUP_URL} | ${env} bash`;
const ISOLATED = 'DECK_ISOLATED=1';
export const UNPAIRED_MARKER = 'ainda não está pareada';

async function expectOk(target, script, opts) {
  const r = await target.exec(script, opts);
  if (r.code !== 0) throw new Error(`exit ${r.code}\n${tail(r.out, 40)}`);
  return r.out;
}

export async function runInstallSteps({ target, step }) {
  await step('Base packages a fresh VPS image ships (curl, ca-certificates)', async () => {
    const out = await expectOk(target, 'export DEBIAN_FRONTEND=noninteractive; command -v curl >/dev/null || (apt-get update -y >/dev/null && apt-get install -y curl ca-certificates >/dev/null); curl --version | head -1', { timeoutMs: 300_000 });
    return tail(out, 3);
  });

  await step('Public one-liner, dry run (isolated mode)', async () => {
    const out = await expectOk(target, ONE_LINER(`${ISOLATED} DECK_DRY_RUN=1`), { timeoutMs: 180_000 });
    if (!/DECK_DRY_RUN=1/.test(out)) throw new Error(`dry-run banner missing\n${tail(out, 20)}`);
    return tail(out, 15);
  });

  await step('Public one-liner, real install (isolated mode, no pairing code)', async () => {
    const out = await expectOk(target, ONE_LINER(`${ISOLATED} DECK_INSTALL_BUILD_TOOLS=1`), { timeoutMs: 1_500_000 });
    if (!out.includes(UNPAIRED_MARKER)) throw new Error(`installer did not stop at the pairing step\n${tail(out, 30)}`);
    return tail(out, 15);
  });

  await step('Install result: deck user has no sudo, repo cloned, native deps load', async () => {
    const out = await expectOk(target, [
      'id deck',
      '! id -nG deck | grep -Eqw "sudo|wheel|admin"',
      'test -d /home/deck/.deck-src/.git',
      'su - deck -c "cd ~/.deck-src && PATH=~/.deck-node/bin:$PATH node -e \\"require(\'node-pty\');require(\'better-sqlite3\');console.log(\'native deps ok\')\\""',
    ].join(' && '), { timeoutMs: 120_000 });
    return tail(out, 5);
  });
}

export async function runPairStep({ target, step, pairCode }) {
  await step('Pair with a real code and start the agent', async () => {
    const out = await expectOk(target, ONE_LINER(`${ISOLATED} DECK_PAIR_CODE=${pairCode}`), { timeoutMs: 600_000 });
    const alive = await target.exec('pgrep -u deck -f "server/agent.ts" >/dev/null && echo agent-running', { timeoutMs: 30_000 });
    if (!alive.out.includes('agent-running')) throw new Error(`agent process not found after pairing\n${tail(out, 20)}`);
    return tail(out, 15).replaceAll(pairCode, '***');
  });
}
