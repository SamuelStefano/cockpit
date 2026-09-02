import { describe, it, expect, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = new URL('./agent-setup.sh', import.meta.url).pathname;
const fonte = readFileSync(SCRIPT, 'utf8');

// O script faz trabalho de verdade ao carregar (instala pacote, clona repo), então
// não dá pra sourceá-lo: extrai a função e roda ela isolada, como em doctor.test.ts.
function extrairFuncao(nome: string): string {
  const linhas = fonte.split('\n');
  const i = linhas.findIndex((l) => l.startsWith(`${nome}() {`));
  const j = linhas.indexOf('}', i);
  if (i < 0 || j < 0) throw new Error(`função ${nome} não encontrada em agent-setup.sh`);
  return linhas.slice(i, j + 1).join('\n');
}

const raiz = mkdtempSync(join(tmpdir(), 'deck-setup-'));
afterAll(() => rmSync(raiz, { recursive: true, force: true }));

// PATH com stubs: `id` fixa uid não-root (senão a suíte rodando como root cairia no
// ramo /etc/cron.d) e `crontab` simula os cenários.
function caixa(nome: string, crontabSh: string): { home: string; bin: string } {
  const dir = join(raiz, nome);
  const bin = join(dir, 'bin');
  const home = join(dir, 'home');
  mkdirSync(bin, { recursive: true });
  mkdirSync(home, { recursive: true });
  writeFileSync(join(bin, 'id'), '#!/bin/sh\ncase "$1" in -u) echo 1000;; -un) echo fellow;; *) exec /usr/bin/id "$@";; esac\n', { mode: 0o755 });
  writeFileSync(join(bin, 'crontab'), crontabSh, { mode: 0o755 });
  return { home, bin };
}

function rodarCron(home: string, bin: string): { status: number | null; saida: string } {
  const r = spawnSync('bash', ['-c', [
    'set -uo pipefail',
    'SUDO=""; RUN_USER="fellow"; UNIT_PATH="/usr/bin:/bin"',
    extrairFuncao('install_cron_job'),
    'install_cron_job deck-teste "*/3 * * * *" "echo oi"',
  ].join('\n')], { env: { ...process.env, HOME: home, PATH: `${bin}:${process.env.PATH}` }, encoding: 'utf8' });
  return { status: r.status, saida: `${r.stdout}${r.stderr}` };
}

describe('agent-setup.sh', () => {
  it('recusa instalar como root sem DECK_ALLOW_ROOT', () => {
    const bin = join(raiz, 'root-bin');
    mkdirSync(bin, { recursive: true });
    writeFileSync(join(bin, 'id'), '#!/bin/sh\ncase "$1" in -u) echo 0;; -un) echo root;; *) exec /usr/bin/id "$@";; esac\n', { mode: 0o755 });
    const r = spawnSync('bash', [SCRIPT], { env: { ...process.env, PATH: `${bin}:${process.env.PATH}` }, encoding: 'utf8' });
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('recusando instalar como root');
    expect(r.stdout).toContain('DECK_ALLOW_ROOT=1');
  });

  // O padrão antigo (`crontab -l | grep -v … | crontab -`) APAGA o crontab do fellow
  // quando a leitura falha por qualquer motivo transitório.
  it('aborta a edição do crontab quando `crontab -l` falha', () => {
    const { home, bin } = caixa('falha', '#!/bin/sh\nif [ "$1" = "-l" ]; then echo "erro de leitura" >&2; exit 2; fi\necho ESCREVEU >&2; exit 0\n');
    const { status, saida } = rodarCron(home, bin);
    expect(status).not.toBe(0);
    expect(saida).toContain('NÃO vou reescrever seu crontab');
    expect(saida).not.toContain('ESCREVEU');
    expect(existsSync(join(home, '.deck-crontab.bak'))).toBe(false);
  });

  it('preserva os jobs do fellow e guarda backup quando `crontab -l` funciona', () => {
    const { home, bin } = caixa('ok', '#!/bin/sh\nif [ "$1" = "-l" ]; then cat "$HOME/atual"; exit 0; fi\ncat > "$HOME/novo"\n');
    writeFileSync(join(home, 'atual'), '5 4 * * * echo job-do-fellow\n');
    const { status } = rodarCron(home, bin);
    expect(status).toBe(0);
    const novo = readFileSync(join(home, 'novo'), 'utf8');
    expect(novo).toContain('echo job-do-fellow');
    expect(novo).toContain('# deck-teste');
    expect(readFileSync(join(home, '.deck-crontab.bak'), 'utf8')).toContain('echo job-do-fellow');
  });

  it('trata "no crontab for user" como crontab vazio, não como falha', () => {
    const { home, bin } = caixa('vazio', '#!/bin/sh\nif [ "$1" = "-l" ]; then echo "no crontab for fellow" >&2; exit 1; fi\ncat > "$HOME/novo"\n');
    const { status } = rodarCron(home, bin);
    expect(status).toBe(0);
    expect(readFileSync(join(home, 'novo'), 'utf8')).toContain('# deck-teste');
  });

  it('mantém opt-in o que mexe na máquina do fellow', () => {
    expect(fonte).toMatch(/DECK_VPS_GUARD:-.*=\s*"1"|"\$\{DECK_VPS_GUARD:-\}" = "1"/);
    expect(fonte).toContain('"${DECK_AUTO_REDEPLOY:-}" = "1"');
    expect(fonte).toContain('"${DECK_EXTRAS:-}" = "1"');
    // hooksPath só dentro do ramo opt-in — nunca solto no fluxo default.
    expect(fonte).not.toMatch(/^git config core\.hooksPath/m);
  });

  it('sobe o agente sob flock e com limite de respawn', () => {
    expect(fonte).toContain('EXEC_START="$FLOCK_BIN -n $LOCK');
    expect(fonte).toContain('StartLimitBurst=5');
    expect(fonte).toContain('StartLimitIntervalSec=300');
  });
});
