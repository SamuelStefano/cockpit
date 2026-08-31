import { describe, it, expect, afterEach } from 'vitest';
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Este script manda SIGKILL. O teste roda SEMPRE em REDEPLOY_DRY_RUN: ele lista os
// alvos e sai, então nem o backend real do Samuel nem os iscas morrem aqui.
const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), 'redeploy.sh');
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const kids: ChildProcess[] = [];
afterEach(() => { for (const k of kids.splice(0)) k.kill('SIGKILL'); });

// Isca viva com argv/cwd controlados, pra o filtro ter o que aceitar e recusar.
// `sh -c cmd nome` põe `nome` no argv como ARGUMENTO INTEIRO ($0) — é a forma do
// inner real (`tsx server/index.ts`).
function iscaArgumento(script: string, cwd: string): number {
  const c = spawn('sh', ['-c', 'sleep 30', script], { cwd, stdio: 'ignore' });
  kids.push(c);
  return c.pid!;
}

// Aqui o caminho vive DENTRO de um argumento maior — como num `git commit -m` ou
// num turno do agente que cita o arquivo.
function iscaMencao(script: string, cwd: string): number {
  const c = spawn('sh', ['-c', `sleep 30 # blá ${script} blá`], { cwd, stdio: 'ignore' });
  kids.push(c);
  return c.pid!;
}

const alvos = (): string => execFileSync('bash', [SCRIPT], {
  env: { ...process.env, REDEPLOY_DRY_RUN: '1' }, encoding: 'utf8',
});

describe('redeploy: escolha de alvos', () => {
  it('mata o inner deste checkout', () => {
    const pid = iscaArgumento('server/index.ts', ROOT);
    expect(alvos()).toContain(String(pid));
  });

  // Todos os oito worktrees rodam `tsx server/index.ts` — argv relativo e IDÊNTICO.
  // O cwd é o único discriminador; sem ele um redeploy aqui derrubava os vizinhos.
  it('preserva um inner de outro checkout', () => {
    const outro = mkdtempSync(`${tmpdir()}/cockpit-wt-`);
    try {
      const pid = iscaArgumento('server/index.ts', outro);
      expect(alvos()).not.toContain(String(pid));
    } finally {
      rmSync(outro, { recursive: true, force: true });
    }
  });

  // `pgrep -f` casa a linha INTEIRA: um `git commit -m "fix server/index.ts"` ou um
  // turno do agente com esse texto no prompt entrava na lista e levava SIGKILL.
  it('preserva processo que só MENCIONA o caminho dentro de um argumento maior', () => {
    const pid = iscaMencao('server/index.ts', ROOT);
    expect(alvos()).not.toContain(String(pid));
  });

  it('preserva o agente ao mirar o backend e vice-versa', () => {
    const backend = iscaArgumento('server/index.ts', ROOT);
    const agente = iscaArgumento('server/agent.ts', ROOT);
    const out = alvos();
    const linha = (label: string) => out.split('\n').find((l) => l.includes(`${label}:`)) ?? '';
    expect(linha('backend')).toContain(String(backend));
    expect(linha('backend')).not.toContain(String(agente));
    expect(linha('agente')).toContain(String(agente));
    expect(linha('agente')).not.toContain(String(backend));
  });

  it('não se mata: o próprio redeploy tem o padrão no argv', () => {
    expect(alvos()).not.toMatch(/DRY RUN, mataria:.*\b0\b/);
    expect(() => alvos()).not.toThrow();
  });
});
