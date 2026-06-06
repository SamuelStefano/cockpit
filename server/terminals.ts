import { spawn as ptySpawn, type IPty } from 'node-pty';
import { spawn } from 'node:child_process';

// Terminais reais via node-pty, cada um ancorado num tmux `new-session -A`
// (attach-or-create) — a sessão sobrevive a restart do backend e a múltiplos
// clientes (multi-device). Um PTY por id; fan-out pros WS conectados.
//
// Segurança (DR-004 #5): o id vira nome de sessão tmux, então é allow-listado
// a [a-zA-Z0-9_-]. argv-array, shell:false — sem injeção.

const NAME_RE = /^[a-zA-Z0-9_-]{1,32}$/;
const MAX_BUFFER = 200_000; // ~200KB de scrollback pra replay no attach

// Sequências de RESPOSTA do terminal (não de tecla). O xterm.js auto-responde a
// queries de Device Attributes (CSI c / CSI > c) e Status Report (CSI n) com
// CSI ? ... c (DA1), CSI > ... c (DA2), CSI ... R (CPR), CSI ? ... $y (DECRPM).
// Essas respostas voltam pelo onData do xterm e, escritas no PTY como se fossem
// digitadas, ecoam no shell e realimentam o loop infinito de "letras e números
// estranhos" (DA1/DA2 repetindo pra sempre). Um humano NUNCA digita isso, então
// filtrar na entrada (cliente->PTY) corta o loop no único ponto de junção, valha
// qual cliente/replay/reset o disparou. Setas (CSI A/B/C/D) e paste (CSI 200~)
// terminam em outra letra e não casam.
const INPUT_REPORT_RE = /\x1b\[\?[0-9;]*c|\x1b\[>[0-9;]*c|\x1b\[[0-9;]*R|\x1b\[\?[0-9;]*\$y/g;
const stripReports = (s: string) => s.replace(INPUT_REPORT_RE, '');

interface Term {
  pty: IPty;
  buffer: string;
  data: Set<(d: string) => void>;
  exit: Set<() => void>;
}

const terms = new Map<string, Term>();

const clampDim = (n: number, def: number) =>
  Number.isFinite(n) && n > 0 ? Math.min(500, Math.max(1, Math.floor(n))) : def;

const PREFIX = 'cockpit-';
function sessionName(id: string): string {
  return `${PREFIX}${id}`;
}

export function parseTermSessions(stdout: string, prefix = PREFIX): string[] {
  return stdout
    .split('\n')
    .map((s) => s.trim())
    .filter((n) => n.startsWith(prefix))
    .map((n) => n.slice(prefix.length))
    .filter((id) => NAME_RE.test(id));
}

// Sessões tmux persistentes do cockpit (sobrevivem a restart): permite reanexar
// a qualquer uma de outro device — as "branches" de terminal da VPS.
export function listTerms(): Promise<string[]> {
  return new Promise((resolve) => {
    const p = spawn('tmux', ['ls', '-F', '#{session_name}'], { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    p.on('close', () => resolve(parseTermSessions(out)));
    p.on('error', () => resolve([]));
  });
}

export function openTerm(
  id: string,
  cols: number,
  rows: number,
  onData: (d: string) => void,
  onExit: () => void,
  onReplay: (d: string) => void,
): boolean {
  if (!NAME_RE.test(id)) return false;

  let t = terms.get(id);
  if (!t) {
    const p = ptySpawn('tmux', ['new-session', '-A', '-s', sessionName(id)], {
      name: 'xterm-256color',
      cols: clampDim(cols, 80),
      rows: clampDim(rows, 24),
      cwd: process.env.HOME,
      env: { ...process.env, TERM: 'xterm-256color' } as Record<string, string>,
    });
    const term: Term = { pty: p, buffer: '', data: new Set(), exit: new Set() };
    p.onData((d) => {
      term.buffer = (term.buffer + d).slice(-MAX_BUFFER);
      for (const l of term.data) l(d);
    });
    p.onExit(() => {
      for (const l of term.exit) l();
      terms.delete(id);
    });
    terms.set(id, t = term);
  }

  t.data.add(onData);
  t.exit.add(onExit);
  // Snapshot do scrollback como mensagem SEPARADA (term-replay): o cliente dá
  // reset() antes de repintar, então reattach/reconnect não DUPLICA a tela.
  // Emitido após registrar onData, então a ordem replay -> live é preservada.
  if (t.buffer) onReplay(t.buffer);
  return true;
}

export function detachTerm(id: string, onData: (d: string) => void, onExit: () => void) {
  const t = terms.get(id);
  if (!t) return;
  t.data.delete(onData);
  t.exit.delete(onExit);
  // PTY fica vivo de propósito: a sessão tmux persiste pra reattach.
}

export function inputTerm(id: string, data: string) {
  terms.get(id)?.pty.write(stripReports(data));
}

export function resizeTerm(id: string, cols: number, rows: number) {
  const t = terms.get(id);
  if (t) t.pty.resize(clampDim(cols, 80), clampDim(rows, 24));
}

// Fecha de fato: mata o PTY e a sessão tmux (não fica órfã).
export function closeTerm(id: string) {
  if (!NAME_RE.test(id)) return;
  const t = terms.get(id);
  if (t) { try { t.pty.kill(); } catch { /* noop */ } terms.delete(id); }
  try { spawn('tmux', ['kill-session', '-t', sessionName(id)], { stdio: 'ignore' }); } catch { /* noop */ }
}
