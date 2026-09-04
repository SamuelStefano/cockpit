import { describe, it, expect, afterAll, afterEach } from 'vitest';
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const fonte = readFileSync(new URL('./doctor.sh', import.meta.url).pathname, 'utf8');

// Roda a própria função do doctor.sh: o script faz trabalho no carregamento
// (flock, curl, kill), então dá pra extrair as funções mas não sourceá-lo inteiro.
const funcoes = fonte
  .split('\n')
  .filter((l) => l.startsWith('supervisor_re()') || l.startsWith('supervisor_alive()'))
  .join('\n');

function alive(caminho: string): boolean {
  try {
    execFileSync('bash', ['-c', `${funcoes}\nsupervisor_alive "$1"`, '_', caminho], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// O check antigo. Cada isca é comparada contra ele pra provar que era de fato uma
// armadilha, e não um processo inventado que padrão nenhum casaria.
function pidsDoPadraoSolto(): number[] {
  try {
    return execFileSync('pgrep', ['-f', 'run-agent.sh'], { encoding: 'utf8' })
      .split('\n').filter(Boolean).map(Number);
  } catch {
    return [];
  }
}

// Caminho fora do checkout: o supervisor de verdade está vivo o tempo todo nesta
// box e mascararia qualquer asserção feita contra o caminho canônico.
const dir = mkdtempSync(join(tmpdir(), 'deck-doctor-'));
const ALVO = join(dir, 'run-agent.sh');
writeFileSync(ALVO, '#!/usr/bin/env bash\nsleep 30\n', { mode: 0o755 });
writeFileSync(join(dir, 'run-agentXsh'), '#!/usr/bin/env bash\nsleep 30\n', { mode: 0o755 });

const vivos: ChildProcess[] = [];
function spawnar(cmd: string, args: string[]): number {
  const p = spawn(cmd, args, { stdio: 'ignore' });
  vivos.push(p);
  execFileSync('sleep', ['0.3']);
  return p.pid!;
}

// Processo que apenas CARREGA o texto no argv, sem ser o supervisor. node aceita
// argumentos extras e fica vivo; `sleep` morreria em "invalid time interval".
const mencao = (texto: string) => spawnar(process.execPath, ['-e', 'setTimeout(() => {}, 30000)', texto]);

afterEach(() => { for (const p of vivos.splice(0)) p.kill('SIGKILL'); });
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('doctor.sh · supervisor_alive isola o checkout', () => {
  // O earlyoom real roda desde 29/07/2026 com `--avoid ^(...|run-agent.sh)$`, e era
  // isso que fazia `pgrep -f 'run-agent.sh'` responder "vivo" pra sempre.
  it('não confunde o earlyoom com o supervisor', () => {
    const pid = mencao('^(systemd|sshd|run-agent.sh)$');
    expect(pidsDoPadraoSolto()).toContain(pid);
    expect(alive(ALVO)).toBe(false);
  });

  it('não confunde o supervisor de outra worktree', () => {
    const pid = mencao('/home/samuel/cockpit-usage/run-agent.sh');
    expect(pidsDoPadraoSolto()).toContain(pid);
    expect(alive(ALVO)).toBe(false);
  });

  // O agente roda shell o tempo todo nesta box; um `ls` do arquivo não é o processo.
  it('não confunde um comando que só menciona o caminho', () => {
    const pid = mencao(ALVO);
    expect(pidsDoPadraoSolto()).toContain(pid);
    expect(alive(ALVO)).toBe(false);
  });

  // Sem escapar o ponto, `run-agent.sh` casaria o `run-agentXsh` ao lado.
  it('trata o ponto do nome como literal', () => {
    const pid = spawnar('bash', [join(dir, 'run-agentXsh')]);
    expect(pidsDoPadraoSolto()).toContain(pid);
    expect(alive(ALVO)).toBe(false);
  });

  it('reconhece o supervisor lançado como `bash <caminho>`', () => {
    spawnar('bash', [ALVO]);
    expect(alive(ALVO)).toBe(true);
  });

  it('reconhece o supervisor lançado pelo shebang', () => {
    spawnar(ALVO, []);
    expect(alive(ALVO)).toBe(true);
  });
});

describe('doctor.sh · o padrão solto não volta', () => {
  it('nenhum pgrep casa supervisor por nome de arquivo', () => {
    expect(fonte.match(/pgrep -f ['"][^'"]*run-(backend|agent)\.sh[^'"]*['"]/g)).toBeNull();
  });

  it('os dois watchdogs passam pelo caminho absoluto', () => {
    expect(fonte).toContain('supervisor_alive "$SUPERVISOR"');
    expect(fonte).toContain('supervisor_alive "$AGENT_SUPERVISOR"');
  });
});

// Passo 4c: drift de código. O gatilho é uma comparação de string entre o
// ~/.cockpit/running-commit (carimbado pelo redeploy.sh) e o HEAD do repo — o
// teste exercita essa lógica isolada, sem disparar deploy de verdade.
describe('doctor.sh · drift de código re-arma o deploy', () => {
  // Reproduz o bloco do doctor com os caminhos parametrizados, pra rodar num repo
  // de mentira. Mantém a MESMA ordem de guardas do script.
  const bloco = `
    head_commit=$(git -C "$REPO" rev-parse HEAD 2>/dev/null || echo "")
    running=$(cat "$RUNNING_COMMIT" 2>/dev/null || echo "")
    if [ -n "$head_commit" ] && [ "$running" != "$head_commit" ]; then
      if [ -z "$(git -C "$REPO" status --porcelain 2>/dev/null)" ]; then echo ARMA; else echo TREE_SUJO; fi
    else echo NADA; fi
  `;

  function repoDeMentira(): string {
    const dir = mkdtempSync(join(tmpdir(), 'doctor-drift-'));
    execFileSync('git', ['init', '-q', dir]);
    execFileSync('git', ['-C', dir, 'config', 'user.email', 't@t'], { stdio: 'ignore' });
    execFileSync('git', ['-C', dir, 'config', 'user.name', 't'], { stdio: 'ignore' });
    writeFileSync(join(dir, 'a.txt'), 'um');
    execFileSync('git', ['-C', dir, 'add', '.'], { stdio: 'ignore' });
    execFileSync('git', ['-C', dir, 'commit', '-qm', 'um'], { stdio: 'ignore' });
    return dir;
  }

  function rodar(repo: string, running: string): string {
    // FORA do repo: escrever o carimbo dentro dele sujaria o working tree e o
    // teste cairia sempre na guarda de tree suja.
    const f = join(tmpdir(), `running-commit-${Math.random().toString(36).slice(2)}`);
    criados.push(f);
    writeFileSync(f, running);
    return execFileSync('bash', ['-c', bloco], {
      encoding: 'utf8', env: { ...process.env, REPO: repo, RUNNING_COMMIT: f },
    }).trim();
  }

  const criados: string[] = [];
  afterAll(() => criados.forEach((d) => rmSync(d, { recursive: true, force: true })));

  it('arma quando o processo roda commit diferente do HEAD', () => {
    const repo = repoDeMentira(); criados.push(repo);
    expect(rodar(repo, 'commitvelho')).toBe('ARMA');
  });

  it('não arma quando o commit rodando é o HEAD', () => {
    const repo = repoDeMentira(); criados.push(repo);
    const head = execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    expect(rodar(repo, head)).toBe('NADA');
  });

  // Subir código pela metade é pior que conviver com o drift por mais 3 minutos.
  it('não arma com o working tree sujo', () => {
    const repo = repoDeMentira(); criados.push(repo);
    writeFileSync(join(repo, 'a.txt'), 'editando');
    expect(rodar(repo, 'commitvelho')).toBe('TREE_SUJO');
  });

  // Primeira execução depois do deploy deste passo: o arquivo ainda não existe.
  // Tratar como drift é o certo — é exatamente o estado "não sei o que está rodando".
  it('arma quando o carimbo ainda não existe', () => {
    const repo = repoDeMentira(); criados.push(repo);
    const out = execFileSync('bash', ['-c', bloco], {
      encoding: 'utf8', env: { ...process.env, REPO: repo, RUNNING_COMMIT: join(tmpdir(), 'nao-existe-mesmo') },
    }).trim();
    expect(out).toBe('ARMA');
  });
});

// O redeploy tem que CARIMBAR o commit, senão o passo 4c dispara pra sempre.
describe('redeploy.sh · carimba o commit que subiu', () => {
  const src = readFileSync(new URL('./redeploy.sh', import.meta.url).pathname, 'utf8');

  it('escreve o HEAD em ~/.cockpit/running-commit', () => {
    expect(src).toMatch(/rev-parse HEAD > "\$HOME\/\.cockpit\/running-commit"/);
  });

  it('carimba DEPOIS do dry-run sair, pra ensaio não mentir sobre o que está no ar', () => {
    expect(src.indexOf('REDEPLOY_DRY_RUN')).toBeLessThan(src.indexOf('running-commit'));
  });
});

// Numa box com turno quase sempre vivo a janela ociosa dura poucos segundos: com
// STEP fixo em 20s o watcher rodava sem nunca pegar uma. O gatilho por drift
// aperta a sondagem.
describe('deploy-when-idle.sh · passo de sondagem', () => {
  const src = readFileSync(new URL('./deploy-when-idle.sh', import.meta.url).pathname, 'utf8');
  const doctor = readFileSync(new URL('./doctor.sh', import.meta.url).pathname, 'utf8');

  it('STEP tem default mas aceita override', () => {
    expect(src).toMatch(/STEP=\$\{STEP:-20\}/);
  });

  it('o doctor aperta o passo ao armar por drift', () => {
    expect(doctor).toMatch(/MAX_WAIT=150 STEP=5 nohup bash/);
  });
});
