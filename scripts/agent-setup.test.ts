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
    // This runs the WHOLE installer and relies on the root guard coming first. If
    // that guard ever moves, every step past it must fail loudly here instead of
    // running sudo/apt-get/npm -g/git clone/systemctl on the dev box.
    for (const cmd of ['sudo', 'apt-get', 'dnf', 'yum', 'npm', 'npx', 'curl', 'git', 'systemctl', 'crontab', 'claude']) {
      writeFileSync(join(bin, cmd), `#!/bin/sh\necho "SENTINEL: ${cmd} reached" >&2\nexit 99\n`, { mode: 0o755 });
    }
    const r = spawnSync('bash', [SCRIPT], { env: { ...process.env, PATH: `${bin}:${process.env.PATH}` }, encoding: 'utf8' });
    expect(r.stderr).not.toContain('SENTINEL');
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
    // Room for the self-update rollback: 3 failed boots + the boot that rolls back.
    expect(fonte).toContain('StartLimitBurst=10');
    expect(fonte).toContain('StartLimitIntervalSec=300');
  });

  // Stub node that answers `-p` (version probe) with a fixed version.
  function stubNode(dir: string, versao: string): void {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'node'), `#!/bin/sh\necho ${versao}\n`, { mode: 0o755 });
  }
  function sentinelas(bin: string, cmds: string[]): void {
    for (const cmd of cmds) {
      writeFileSync(join(bin, cmd), `#!/bin/sh\necho "SENTINEL: ${cmd} reached" >&2\nexit 99\n`, { mode: 0o755 });
    }
  }
  function rodarPickNode(home: string, bin: string): { status: number | null; saida: string; dir: string } {
    const r = spawnSync('bash', ['-c', [
      'set -uo pipefail',
      extrairFuncao('pick_node'),
      'pick_node || exit 3',
      'echo "DIR=$NODE_DIR HOW=$NODE_HOW"',
    ].join('\n')], { env: { HOME: home, PATH: `${bin}:/usr/bin:/bin` }, encoding: 'utf8' });
    return { status: r.status, saida: `${r.stdout}${r.stderr}`, dir: /DIR=(\S*)/.exec(r.stdout)?.[1] ?? '' };
  }

  it('pick_node reaproveita o node do PATH (v22) sem chamar curl', () => {
    const { home, bin } = caixa('pick-path', '#!/bin/sh\n');
    stubNode(bin, '22.1.0');
    sentinelas(bin, ['curl', 'sudo', 'apt-get']);
    const r = rodarPickNode(home, bin);
    expect(r.saida).not.toContain('SENTINEL');
    expect(r.status).toBe(0);
    expect(r.dir).toBe(bin);
    expect(r.saida).toContain('HOW=reuse');
  });

  it('pick_node troca um node v18 do PATH pelo do nvm (v20)', () => {
    const { home, bin } = caixa('pick-nvm', '#!/bin/sh\n');
    stubNode(bin, '18.19.0');
    const nvmBin = join(home, '.nvm/versions/node/v20.11.0/bin');
    stubNode(nvmBin, '20.11.0');
    sentinelas(bin, ['curl']);
    const r = rodarPickNode(home, bin);
    expect(r.saida).not.toContain('SENTINEL');
    expect(r.status).toBe(0);
    expect(r.dir).toBe(nvmBin);
  });

  it('DECK_DRY_RUN=1 imprime o plano e não alcança nenhum instalador', () => {
    const { home, bin } = caixa('dry', '#!/bin/sh\n');
    stubNode(bin, '22.1.0');
    for (const cmd of ['git', 'curl', 'claude', 'systemctl']) {
      writeFileSync(join(bin, cmd), `#!/bin/sh\necho "SENTINEL: ${cmd} executed" >&2\nexit 99\n`, { mode: 0o755 });
    }
    sentinelas(bin, ['sudo', 'apt-get', 'dnf', 'yum', 'npm', 'npx', 'crontab']);
    const r = spawnSync('bash', [SCRIPT], { env: { HOME: home, PATH: `${bin}:/usr/bin:/bin`, DECK_DRY_RUN: '1' }, encoding: 'utf8' });
    expect(r.stderr).not.toContain('SENTINEL');
    expect(r.status).toBe(0);
    for (const alvo of ['git:', 'curl:', 'node:', 'build tools:', 'claude:', 'systemd unit:']) expect(r.stdout).toContain(alvo);
    expect(r.stdout).toContain('node: reaproveita');
    expect(r.stdout).toContain('claude: reaproveita');
  });

  describe('modo isolado (DECK_ISOLATED=1)', () => {
    const PERIGOSOS = ['sudo', 'apt-get', 'dnf', 'yum', 'npm', 'npx', 'curl', 'git', 'systemctl', 'crontab', 'claude', 'useradd', 'adduser', 'runuser', 'su'];

    function caixaIsolada(nome: string, uid: number, idDeck: string): { home: string; bin: string } {
      const dir = join(raiz, nome);
      const bin = join(dir, 'bin');
      const home = join(dir, 'home');
      mkdirSync(bin, { recursive: true });
      mkdirSync(home, { recursive: true });
      writeFileSync(join(bin, 'id'), `#!/bin/sh\ncase "$1" in -u) echo ${uid};; -un) echo x;; deck) ${idDeck};; *) exec /usr/bin/id "$@";; esac\n`, { mode: 0o755 });
      sentinelas(bin, PERIGOSOS);
      return { home, bin };
    }

    it('sem root sai 1 com orientação e não alcança nenhum comando perigoso', () => {
      const { home, bin } = caixaIsolada('iso-user', 1000, 'echo "id: deck: no such user" >&2; exit 1');
      const r = spawnSync('bash', [SCRIPT], { env: { HOME: home, PATH: `${bin}:/usr/bin:/bin`, DECK_ISOLATED: '1' }, encoding: 'utf8' });
      expect(r.stderr).not.toContain('SENTINEL');
      expect(r.status).toBe(1);
      expect(r.stdout).toContain('precisa de root');
      expect(r.stdout).toContain('sudo DECK_ISOLATED=1');
    });

    it('DRY_RUN como root imprime o plano e não cria usuário, serviço nem instala nada', () => {
      const { home, bin } = caixaIsolada('iso-dry', 0, 'echo "id: deck: no such user" >&2; exit 1');
      const r = spawnSync('bash', [SCRIPT], { env: { HOME: home, PATH: `${bin}:/usr/bin:/bin`, DECK_ISOLATED: '1', DECK_DRY_RUN: '1' }, encoding: 'utf8' });
      expect(r.stderr).not.toContain('SENTINEL');
      expect(r.status).toBe(0);
      expect(r.stdout).toContain('usuário deck: criaria');
      expect(r.stdout).toContain('/etc/systemd/system/deck-agent.service');
      expect(r.stdout).toContain('depois que o usuário existir');
    });

    it('recusa um usuário deck que já está no grupo sudo', () => {
      const { home, bin } = caixaIsolada('iso-sudo', 0, 'echo "uid=1001(deck)"');
      const idBin = readFileSync(join(bin, 'id'), 'utf8').replace('*) exec', '-nG) echo "deck sudo";; *) exec');
      writeFileSync(join(bin, 'id'), idBin.replace('case "$1" in', 'case "$1$2" in').replace('deck) echo', 'deck*) echo').replace('-nG)', '-nGdeck)'), { mode: 0o755 });
      const r = spawnSync('bash', [SCRIPT], { env: { HOME: home, PATH: `${bin}:/usr/bin:/bin`, DECK_ISOLATED: '1', DECK_DRY_RUN: '1' }, encoding: 'utf8' });
      expect(r.stderr).not.toContain('SENTINEL');
      expect(r.status).toBe(1);
      expect(r.stdout).toContain('sudo/wheel/admin');
    });

    it('write_install_env grava install.env 600 com valores entre aspas e load_install_env o lê sem executar', () => {
      const { home } = caixa('iso-env', '#!/bin/sh\n');
      const r = spawnSync('bash', ['-c', [
        'set -euo pipefail',
        extrairFuncao('write_install_env'),
        extrairFuncao('load_install_env'),
        `AGENT_DIR="${home}/.deck-agent"; SRC_DIR=/home/deck/.deck-src; NODE_BIN=/usr/bin; CLAUDE_DIR=/home/deck/.deck-npm/bin; NPX_BIN=/usr/bin/npx; RELAY=wss://r.test; ROLE=admin`,
        'write_install_env',
        'stat -c %a "$AGENT_DIR/install.env"',
        'cat "$AGENT_DIR/install.env"',
        'ROLE=x; load_install_env "$AGENT_DIR/install.env"; echo "ROLE=$ROLE"',
        'printf "%s\\n" "SRC_DIR=\'/tmp/x\'; touch /tmp/pwned" > "$AGENT_DIR/bad.env"',
        'load_install_env "$AGENT_DIR/bad.env" && echo ACEITOU || echo REJEITADO',
      ].join('\n')], { encoding: 'utf8' });
      expect(r.status).toBe(0);
      expect(r.stdout).toContain('600');
      expect(r.stdout).toContain("SRC_DIR='/home/deck/.deck-src'");
      expect(r.stdout).toContain("RELAY='wss://r.test'");
      expect(r.stdout).toContain('ROLE=admin');
      expect(r.stdout).toContain('REJEITADO');
    });
  });

  describe('deck-agent wrapper', () => {
    // Values with spaces, quotes and $(…): baked with %q, none may run as shell.
    function gerarWrapper(nome: string, runUser: string) {
      const dir = join(raiz, nome);
      const bin = join(dir, 'bin');
      const src = join(dir, "src dir 'q'");
      const log = join(dir, 'log');
      mkdirSync(bin, { recursive: true });
      mkdirSync(src, { recursive: true });
      writeFileSync(join(bin, 'npx'), `#!/bin/sh\n{ pwd; echo "ARGS $*"; echo "RELAY=$DECK_RELAY_URL"; echo "DIR=$DECK_AGENT_DIR"; echo "HOME=$HOME"; } >> "${log}"\n`, { mode: 0o755 });
      writeFileSync(join(bin, 'id'), `#!/bin/sh\ncase "$1 $2" in "-u ") echo 1000;; "-u fellow") echo 1000;; "-u "*) echo 1001;; *) exec /usr/bin/id "$@";; esac\n`, { mode: 0o755 });
      writeFileSync(join(bin, 'sudo'), `#!/bin/sh\necho "SUDO $*" >> "${log}"\n`, { mode: 0o755 });
      const dest = join(dir, 'out', 'deck-agent');
      const r = spawnSync('bash', ['-c', [
        'set -euo pipefail',
        extrairFuncao('render_deck_agent_wrapper'),
        extrairFuncao('write_deck_agent_wrapper'),
        `RUN_USER=${runUser}; HOME="${dir}/h \\$(touch ${dir}/pwned)"; SRC_DIR="${src}"; AGENT_DIR="${dir}/agent \\"x\\""; RELAY='wss://r.test/$(touch ${dir}/pwned)'; UNIT_PATH="${bin}:/usr/bin:/bin"`,
        `write_deck_agent_wrapper "${dest}"`,
      ].join('\n')], { encoding: 'utf8' });
      expect(r.status, r.stderr).toBe(0);
      const run = (...args: string[]) => spawnSync(dest, args, { env: { PATH: `${bin}:/usr/bin:/bin` }, encoding: 'utf8' });
      const lido = () => (existsSync(log) ? readFileSync(log, 'utf8') : '');
      return { dir, src, dest, run, lido };
    }

    it('runs the agent as the service user, in the clone, with the baked env', () => {
      const w = gerarWrapper('wrapper-ok', 'fellow');
      expect(spawnSync('bash', ['-n', w.dest]).status).toBe(0);
      expect(w.run('enroll-device').status).toBe(0);
      const out = w.lido();
      expect(out).toContain(`${w.src}\nARGS tsx server/agent.ts --enroll-device`);
      expect(out).toContain(`RELAY=wss://r.test/$(touch ${w.dir}/pwned)`);
      expect(out).toContain(`DIR=${w.dir}/agent "x"`);
      expect(out).toContain(`HOME=${w.dir}/h $(touch ${w.dir}/pwned)`);
      expect(w.run('revoke-device', 'AbCdEf12').status).toBe(0);
      expect(w.lido()).toContain('ARGS tsx server/agent.ts --revoke-device=AbCdEf12');
      expect(existsSync(join(w.dir, 'pwned'))).toBe(false);
    });

    it('rejects anything but its three subcommands', () => {
      const w = gerarWrapper('wrapper-bad', 'fellow');
      for (const args of [[], ['--pair'], ['enroll-device', 'x'], ['revoke-device', 'ab;id'], ['revoke-device', 'abc'], ['sh']]) {
        expect(w.run(...args).status).toBe(2);
      }
      expect(w.lido()).toBe('');
    });

    it('re-execs through sudo as the service user when run by another user', () => {
      const w = gerarWrapper('wrapper-sudo', 'deck');
      expect(w.run('enroll-device').status).toBe(0);
      expect(w.lido()).toBe(`SUDO -H -u deck -- ${w.dest} enroll-device\n`);
    });
  });
});
