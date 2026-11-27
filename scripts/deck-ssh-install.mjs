import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const SETUP_URL = 'https://raw.githubusercontent.com/SamuelStefano/cockpit/main/scripts/agent-setup.sh';
const TARGET_RE = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,63}@(?:[A-Za-z0-9][A-Za-z0-9.-]{0,252}|\[[0-9A-Fa-f:]{2,45}\])$/;
const CODE_RE = /^[A-Za-z0-9_-]{4,64}$/;

export function parseArgs(argv) {
  const out = { target: '', identity: '', port: '', trustNewHost: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-i') out.identity = argv[++i] ?? '';
    else if (a === '-p') out.port = argv[++i] ?? '';
    else if (a === '--trust-new-host') out.trustNewHost = true;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a.startsWith('-')) throw new Error(`unknown option: ${a}`);
    else if (!out.target) out.target = a;
    else throw new Error('only one target is allowed');
  }
  return out;
}

export function validate(opts, code) {
  if (!TARGET_RE.test(opts.target)) throw new Error('target must look like user@host');
  if (!CODE_RE.test(code)) throw new Error('missing or invalid pairing code (set DECK_PAIR_CODE)');
  if (opts.port && !(/^\d{1,5}$/.test(opts.port) && Number(opts.port) >= 1 && Number(opts.port) <= 65535)) throw new Error('invalid port');
  if (opts.identity && (opts.identity.startsWith('-') || opts.identity.includes('\0'))) throw new Error('invalid key path');
}

export function remoteCommand() {
  return `read -r C && curl -fsSL ${SETUP_URL} | sudo DECK_ISOLATED=1 DECK_PAIR_CODE="$C" bash`;
}

export function buildSshArgs(opts) {
  const args = ['-o', `StrictHostKeyChecking=${opts.trustNewHost ? 'accept-new' : 'yes'}`, '-o', 'ForwardAgent=no', '-o', 'ForwardX11=no'];
  if (opts.identity) args.push('-i', opts.identity, '-o', 'IdentitiesOnly=yes');
  if (opts.port) args.push('-p', opts.port);
  args.push('--', opts.target, remoteCommand());
  return args;
}

export function run(argv, env, spawnFn = spawn, log = console.error) {
  if (env.DECK_SSH_ONBOARDING !== '1') {
    log('SSH onboarding is disabled. Set DECK_SSH_ONBOARDING=1 to enable.');
    return Promise.resolve(2);
  }
  let opts;
  const code = (env.DECK_PAIR_CODE ?? '').trim();
  try {
    opts = parseArgs(argv);
    validate(opts, code);
  } catch (e) {
    log(`error: ${e.message}`);
    return Promise.resolve(2);
  }
  const args = buildSshArgs(opts);
  if (opts.dryRun) {
    log(`ssh ${args.map((a) => JSON.stringify(a)).join(' ')}\npairing code: <redacted>`);
    return Promise.resolve(0);
  }
  return new Promise((resolve) => {
    const child = spawnFn('ssh', args, { stdio: ['pipe', 'inherit', 'inherit'], shell: false });
    child.on('error', (e) => { log(`could not start ssh: ${e.message}`); resolve(127); });
    child.on('close', (c) => {
      if (c === 255) log('ssh failed. If the host key is unknown, verify its fingerprint out of band, then connect once manually or pass --trust-new-host.');
      resolve(c ?? 1);
    });
    child.stdin.on('error', () => {});
    child.stdin.end(`${code}\n`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await run(process.argv.slice(2), process.env);
}
