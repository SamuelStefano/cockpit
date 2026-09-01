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
