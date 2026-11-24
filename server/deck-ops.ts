import { execFile, spawn } from 'node:child_process';
import { mkdirSync, openSync, closeSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { claudeBin, cliPath, resolveCli } from './engine/cli-path';
import { IS_WINDOWS } from './platform';
import { cliUpdater, compareVersions, parseCliVersion } from './engine/cli-update';
import type { ClaudeCliInfo, DeckInfo } from '../shared/protocol';

const run = promisify(execFile);

// Raiz DESTE checkout: os scripts de restart só derrubam o inner cujo cwd é esta
// raiz (redeploy.sh#is_ours), então o caminho precisa vir do módulo em execução,
// nunca do PATH ou do cwd de quem subiu o supervisor.
export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IDLE_LOCK = '/tmp/deck-deploy-when-idle.lock';
const LOG = join(homedir(), '.cockpit', 'deck-update.log');

export { parseCliVersion };

// Versão do `claude` que o SPAWN do Deck enxerga (PATH prefixado por cliPath),
// não a do PATH do supervisor — é exatamente esse binário que a API valida.
export async function claudeCliInfo(): Promise<ClaudeCliInfo> {
  const env = { ...process.env, PATH: cliPath() };
  const [version, path] = await Promise.all([
    run(claudeBin(), ['--version'], { env, timeout: 15_000 }).then((r) => parseCliVersion(r.stdout)).catch(() => ''),
    IS_WINDOWS ? Promise.resolve(resolveCli()) : run('which', ['claude'], { env, timeout: 5_000 }).then((r) => r.stdout.trim()).catch(() => ''),
  ]);
  return { version, path: path.replace(homedir(), '~') };
}

let bootCommit: Promise<string> | undefined;
function gitHead(): Promise<string> {
  return run('git', ['-C', REPO_ROOT, 'rev-parse', '--short', 'HEAD'], { timeout: 5_000 })
    .then((r) => r.stdout.trim()).catch(() => '');
}

// Mesmos sinais que deploy-when-idle.sh usa pra decidir se pode reiniciar: qualquer
// `claude -p` vivo na box (não só os runs deste processo) e o flock do script.
async function inFlight(): Promise<number> {
  return run('pgrep', ['-fc', 'claude -p'], { timeout: 5_000 })
    .then((r) => Number.parseInt(r.stdout, 10) || 0).catch(() => 0);
}
async function restartArmed(): Promise<boolean> {
  return run('flock', ['-n', IDLE_LOCK, 'true'], { timeout: 5_000 }).then(() => false).catch(() => true);
}

export async function deckInfo(): Promise<DeckInfo> {
  bootCommit ??= gitHead();
  const [boot, head, flying, armed] = await Promise.all([bootCommit, gitHead(), inFlight(), restartArmed()]);
  return { bootCommit: boot, headCommit: head, inFlight: flying, restartArmed: armed };
}

// Same path as the agent's auto-update: npm latest into the managed prefix (or the
// native installer in place); new spawns pick it up without restarting the Deck.
export async function updateClaudeCli(): Promise<{ ok: boolean; message: string }> {
  const u = cliUpdater();
  const [before, want] = await Promise.all([u.installed(), u.latest()]);
  if (want && before.version && compareVersions(before.version, want) >= 0) {
    return { ok: true, message: `CLI já estava na ${before.version}` };
  }
  const r = await u.update('manual', want || null);
  if (!r.ok) return { ok: false, message: `atualização do CLI falhou: ${r.message}` };
  return { ok: true, message: `CLI ${r.from || '?'} → ${r.to}` };
}

// Reinício desacoplado do processo: o script vira sessão própria (detached) e loga
// em ~/.cockpit, porque em modo 'now' quem morre é justamente este processo.
export async function restartDeck(mode: 'idle' | 'now'): Promise<{ ok: boolean; message: string }> {
  if (mode === 'idle' && (await restartArmed())) {
    return { ok: true, message: 'restart já estava agendado; entra quando não houver turno em voo' };
  }
  // The redeploy scripts are bash, and a bash.exe here would run them inside WSL.
  if (IS_WINDOWS) return { ok: false, message: 'no Windows, reinicie a tarefa deck-agent no Agendador de Tarefas' };
  const script = join(REPO_ROOT, 'scripts', mode === 'now' ? 'redeploy.sh' : 'deploy-when-idle.sh');
  mkdirSync(dirname(LOG), { recursive: true });
  const out = openSync(LOG, 'a');
  const child = spawn('bash', [script], { cwd: REPO_ROOT, detached: true, stdio: ['ignore', out, out] });
  // The child holds its own copy of the fd; ours would leak one per restart.
  closeSync(out);
  // A spawn failure is emitted as 'error'; with no listener it would be an
  // uncaughtException, and index.ts kills every run on that.
  child.on('error', () => {});
  child.unref();
  return mode === 'now'
    ? { ok: true, message: 'reiniciando agora — o Deck volta em alguns segundos' }
    : { ok: true, message: 'restart agendado; entra quando não houver turno em voo' };
}
