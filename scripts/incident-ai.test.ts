import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync, chmodSync, existsSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), 'incident-ai.sh');

let tmp: string;
let repo: string;
let origin: string;
let logFile: string;
let argvFile: string;
let binDir: string;

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' });
}

// Shim de `claude` na frente do PATH. O script real invoca o binário de verdade; sem
// isto um teste subiria um turno pago. O shim grava o argv (é o que a suíte inspeciona)
// e opcionalmente encena o que o triador faria.
function fakeClaude(body: string): void {
  const p = join(binDir, 'claude');
  writeFileSync(p, `#!/usr/bin/env bash\nfor a in "$@"; do echo "$a"; done >"${argvFile}"\n${body}\n`, 'utf8');
  chmodSync(p, 0o755);
}

function run(): string {
  execFileSync('bash', [SCRIPT], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH}`,
      COCKPIT_REPO: repo,
      COCKPIT_INCIDENTS: join(tmp, 'incidents.jsonl'),
      COCKPIT_INCIDENT_STATE: join(tmp, 'offset'),
      COCKPIT_INCIDENT_LOG: logFile,
      COCKPIT_INCIDENT_LOCK: join(tmp, 'lock'),
      COCKPIT_AGENT_LOG: join(tmp, 'agent.out'),
      COCKPIT_ANTHROPIC_CREDENTIALS: join(tmp, 'creds'),
    },
  });
  return existsSync(logFile) ? readFileSync(logFile, 'utf8') : '';
}

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'incident-ai-'));
  repo = join(tmp, 'repo');
  origin = join(tmp, 'origin.git');
  logFile = join(tmp, 'incident-ai.log');
  argvFile = join(tmp, 'argv.txt');
  binDir = join(tmp, 'bin');
  mkdirSync(repo);
  mkdirSync(binDir);

  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origin]);
  git(repo, 'init', '-q', '-b', 'main');
  git(repo, 'config', 'user.email', 't@t');
  git(repo, 'config', 'user.name', 'teste');
  git(repo, 'remote', 'add', 'origin', origin);
  writeFileSync(join(repo, 'a.txt'), 'base\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-qm', 'base');
  git(repo, 'push', '-q', '-u', 'origin', 'main');

  writeFileSync(join(tmp, 'creds'), 'ANTHROPIC_API_KEY=sk-teste\n');
  writeFileSync(join(tmp, 'incidents.jsonl'), '{"kind":"run-error"}\n{"kind":"reaped"}\n');
  fakeClaude('');
});

afterEach(() => rmSync(tmp, { recursive: true, force: true }));

describe('incident-ai: guardas antes de gastar token', () => {
  it('aborta com a working tree suja', () => {
    writeFileSync(join(repo, 'a.txt'), 'trabalho em voo\n');
    expect(run()).toContain('working tree sujo');
    expect(existsSync(argvFile)).toBe(false);
  });

  // O checkout do Samuel fica em branch de trabalho o tempo todo, e uma branch com tudo
  // commitado passa no guard de tree limpa. Sem este segundo guard o `git checkout -b`
  // do triador sairia de cima do trabalho dele.
  it('aborta fora da main mesmo com a tree limpa', () => {
    git(repo, 'checkout', '-qb', 'feat/trabalho-do-samuel');
    const out = run();
    expect(out).toContain('não na main');
    expect(existsSync(argvFile)).toBe(false);
    expect(git(repo, 'branch', '--show-current').trim()).toBe('feat/trabalho-do-samuel');
  });

  it('aborta sem ANTHROPIC_API_KEY em vez de cair na quota do plano', () => {
    writeFileSync(join(tmp, 'creds'), '');
    expect(run()).toContain('sem ANTHROPIC_API_KEY');
    expect(existsSync(argvFile)).toBe(false);
  });

  it('rotaciona o log quando passa do teto', () => {
    writeFileSync(logFile, 'linha de ruído do cron\n'.repeat(30_000));
    run();
    expect(statSync(logFile).size).toBeLessThan(512 * 1024);
  });

  // A saída crua do `claude` é anexada aqui com `>>`, então o arquivo pode passar do teto
  // numa linha só — e `tail -n` devolveria ela inteira, sem cortar nada.
  it('rotaciona mesmo quando o excesso está numa única linha', () => {
    writeFileSync(logFile, `${'x'.repeat(600 * 1024)}\n`);
    run();
    expect(statSync(logFile).size).toBeLessThan(512 * 1024);
  });
});

describe('incident-ai: o triador não recebe bypass', () => {
  it('passa permission-mode default e nunca bypassPermissions', () => {
    run();
    const argv = readFileSync(argvFile, 'utf8').split('\n');
    expect(argv).toContain('--permission-mode');
    expect(argv).toContain('default');
    expect(argv).not.toContain('bypassPermissions');
    expect(argv).not.toContain('--dangerously-skip-permissions');
  });

  // Os limites do cabeçalho valiam só como frase no prompt, num prompt que embute stderr
  // e log de agente — dado que o Deck não controla. Aqui eles viram argumento.
  it('nega push, gh e kill mesmo se um settings.allow abrir depois', () => {
    run();
    const argv = readFileSync(argvFile, 'utf8').split('\n');
    expect(argv).toContain('--disallowedTools');
    for (const t of ['Bash(git push:*)', 'Bash(gh:*)', 'Bash(pkill:*)', 'Bash(./scripts/redeploy.sh:*)']) {
      expect(argv).toContain(t);
    }
  });

  it('não põe push nem gh na allowlist', () => {
    run();
    const allow = readFileSync(argvFile, 'utf8').split('\n');
    const i = allow.indexOf('--allowedTools');
    const j = allow.indexOf('--disallowedTools');
    expect(i).toBeGreaterThan(-1);
    expect(allow.slice(i + 1, j).filter((a) => /git push|^Bash\(gh/.test(a))).toEqual([]);
  });
});

describe('incident-ai: quem publica é o script', () => {
  it('pusha a branch que o triador criou e volta pra main', () => {
    fakeClaude([
      `cd "${repo}"`,
      'git checkout -qb fix/incidente-teste',
      'echo fix > b.txt && git add -A && git commit -qm "fix: corrige o incidente"',
    ].join('\n'));
    run();
    expect(git(origin, 'branch', '--list', 'fix/incidente-teste')).toContain('fix/incidente-teste');
    expect(git(repo, 'branch', '--show-current').trim()).toBe('main');
  });

  it('não publica nada se o triador ficou na main', () => {
    run();
    expect(readFileSync(logFile, 'utf8')).toContain('nada a publicar');
    expect(git(origin, 'branch', '--list')).not.toContain('fix/');
  });
});
