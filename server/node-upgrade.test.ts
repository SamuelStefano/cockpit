import { describe, it, expect } from 'vitest';
import { planNodeUpgrade, pickTarball, nodeArch, upgradeNode, NODE_DIST, type NodeFacts, type UpgradeDeps } from './node-upgrade';

const HOME = '/home/deck';
const facts = (o: Partial<NodeFacts> = {}): NodeFacts => ({
  version: 'v20.20.2', execPath: `${HOME}/.deck-node/bin/node`, home: HOME, uid: 1001, ownerUid: 1001,
  supervised: true, env: {}, lastFailureAt: null, now: 1_000_000_000, ...o,
});

describe('planNodeUpgrade', () => {
  it('upgrades the installer Node 20 owned by the agent user', () => expect(planNodeUpgrade(facts())).toBe('upgrade'));
  it('leaves Node 22+ alone', () => expect(planNodeUpgrade(facts({ version: 'v22.22.0' }))).toBe('current'));
  it('never touches a system Node', () => expect(planNodeUpgrade(facts({ execPath: '/usr/bin/node' }))).toBe('system-node'));
  it('skips a ~/.deck-node owned by someone else', () => expect(planNodeUpgrade(facts({ ownerUid: 0 }))).toBe('not-owner'));
  it('needs a supervisor to come back', () => expect(planNodeUpgrade(facts({ supervised: false }))).toBe('unsupervised'));
  it('honours DECK_NODE_UPGRADE=off', () => expect(planNodeUpgrade(facts({ env: { DECK_NODE_UPGRADE: 'off' } }))).toBe('disabled'));
  it('waits a day after a failure', () => {
    expect(planNodeUpgrade(facts({ lastFailureAt: 1_000_000_000 - 60_000 }))).toBe('recent-failure');
    expect(planNodeUpgrade(facts({ lastFailureAt: 1_000_000_000 - 25 * 3600_000 }))).toBe('upgrade');
  });
});

const SHASUMS = [
  `${'a'.repeat(64)}  node-v22.22.0-darwin-arm64.tar.gz`,
  `${'b'.repeat(64)}  node-v22.22.0-linux-arm64.tar.gz`,
  `${'c'.repeat(64)}  node-v22.22.0-linux-x64.tar.gz`,
  `${'d'.repeat(64)}  node-v22.22.0-linux-x64.tar.xz`,
].join('\n');

describe('pickTarball', () => {
  it('picks the linux .tar.gz for the arch with its checksum', () => {
    expect(pickTarball(SHASUMS, 'x64')).toEqual({ file: 'node-v22.22.0-linux-x64.tar.gz', sha256: 'c'.repeat(64) });
    expect(pickTarball(SHASUMS, 'arm64')?.sha256).toBe('b'.repeat(64));
    expect(pickTarball(SHASUMS, 'ppc64le')).toBeNull();
    expect(nodeArch('ia32')).toBeNull();
  });
});

function fakeBox(o: { sha?: string; tarOk?: boolean; newVersion?: string; rebuildOk?: boolean; busy?: boolean; verified?: boolean } = {}) {
  const calls: string[] = [];
  const dirs = new Set<string>([`${HOME}/.deck-node`]);
  if (o.verified) { dirs.add(`${HOME}/.deck-node.new`); dirs.add(`${HOME}/.deck-node.new/.deck-verified`); }
  let failed = 0;
  const deps: UpgradeDeps = {
    home: HOME, cwd: '/src', arch: 'x64',
    fetchText: async (url) => { calls.push(`fetch ${url}`); return SHASUMS; },
    download: async (url, dest) => { calls.push(`download ${url} ${dest}`); },
    sha256: async () => o.sha ?? 'c'.repeat(64),
    exec: async (cmd, args, x) => {
      calls.push([cmd, ...args, x.pathFront ? `PATH=${x.pathFront}` : ''].join(' ').trim());
      if (cmd === 'tar') return { ok: o.tarOk !== false, stdout: '', stderr: 'tar: broken' };
      if (cmd.endsWith('/bin/node')) return { ok: true, stdout: `${o.newVersion ?? 'v22.22.0'}\n`, stderr: '' };
      if (cmd.endsWith('.deck-node.new/bin/npm')) return { ok: o.rebuildOk !== false, stdout: '', stderr: 'gyp ERR!' };
      return { ok: true, stdout: '', stderr: '' };
    },
    rm: (p) => { calls.push(`rm ${p}`); dirs.delete(p); },
    touch: (p) => { dirs.add(p); },
    mkdir: (p) => { dirs.add(p); },
    rename: (a, b) => { calls.push(`mv ${a} ${b}`); dirs.delete(a); dirs.add(b); },
    exists: (p) => dirs.has(p),
    busy: () => !!o.busy,
    markFailed: () => { failed++; },
    log: () => {},
  };
  return { deps, calls, dirs, failed: () => failed };
}

describe('upgradeNode', () => {
  it('downloads, verifies, rebuilds with the new Node, then swaps', async () => {
    const b = fakeBox();
    expect(await upgradeNode(b.deps)).toBe('swapped');
    expect(b.calls).toContain(`fetch ${NODE_DIST}/SHASUMS256.txt`);
    expect(b.calls).toContain(`download ${NODE_DIST}/node-v22.22.0-linux-x64.tar.gz ${HOME}/.deck-node.tgz`);
    expect(b.calls).toContain(`${HOME}/.deck-node.new/bin/npm rebuild PATH=${HOME}/.deck-node.new/bin`);
    const rebuild = b.calls.findIndex((c) => c.includes('npm rebuild'));
    const swap = b.calls.indexOf(`mv ${HOME}/.deck-node.new ${HOME}/.deck-node`);
    expect(rebuild).toBeGreaterThan(-1);
    expect(swap).toBeGreaterThan(rebuild);
    expect(b.dirs.has(`${HOME}/.deck-node.old`)).toBe(false);
  });

  it('refuses a tarball whose checksum does not match', async () => {
    const b = fakeBox({ sha: 'f'.repeat(64) });
    expect(await upgradeNode(b.deps)).toBe('failed');
    expect(b.calls.some((c) => c.startsWith('tar'))).toBe(false);
    expect(b.calls.some((c) => c.startsWith('mv'))).toBe(false);
    expect(b.failed()).toBe(1);
  });

  it('does not swap when the extracted Node does not run as 22', async () => {
    const b = fakeBox({ newVersion: 'v20.1.0' });
    expect(await upgradeNode(b.deps)).toBe('failed');
    expect(b.calls.some((c) => c.startsWith('mv'))).toBe(false);
  });

  it('a failed rebuild is rebuilt again with the old Node and nothing is swapped', async () => {
    const b = fakeBox({ rebuildOk: false });
    expect(await upgradeNode(b.deps)).toBe('failed');
    expect(b.calls).toContain(`${HOME}/.deck-node/bin/npm rebuild PATH=${HOME}/.deck-node/bin`);
    expect(b.calls.some((c) => c.startsWith('mv'))).toBe(false);
    expect(b.dirs.has(`${HOME}/.deck-node`)).toBe(true);
  });

  it('waits for no turn in flight before touching node_modules', async () => {
    const b = fakeBox({ busy: true });
    expect(await upgradeNode(b.deps)).toBe('busy');
    expect(b.calls.some((c) => c.includes('rebuild'))).toBe(false);
    expect(b.dirs.has(`${HOME}/.deck-node.new/.deck-verified`)).toBe(true);
  });

  it('reuses a verified copy instead of downloading again', async () => {
    const b = fakeBox({ verified: true });
    expect(await upgradeNode(b.deps)).toBe('swapped');
    expect(b.calls.some((c) => c.startsWith('download'))).toBe(false);
  });
});
