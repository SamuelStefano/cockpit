import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { CONFIG } from '../config';
import { applySlashCommands } from './slash';

// O CLI só reporta seus slash_commands (skills, /compact, /review, MCPs, etc.) no
// evento `system`/init — que normalmente só dispara quando um run começa. Resultado:
// o palette "/" fica só com o seed app-side até a 1ª mensagem. Aqui sondamos UMA vez
// no startup: spawnamos o claude headless, lemos a 1ª linha (o system event vem ANTES
// da inferência do modelo), extraímos slash_commands e matamos o processo na hora —
// custo ~zero de tokens. env mínimo + permission-mode plan, espelhando o run real.
export function probeSlashCommands(): void {
  let child;
  try {
    child = spawn('claude', ['-p', '.', '--output-format', 'stream-json', '--verbose', '--permission-mode', 'plan', '--strict-mcp-config'], {
      cwd: CONFIG.workdir,
      env: { PATH: process.env.PATH, HOME: process.env.HOME, LANG: process.env.LANG ?? 'en_US.UTF-8', TERM: 'dumb' },
      shell: false,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch { return; }

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    try { if (child.pid) process.kill(-child.pid, 'SIGKILL'); } catch { try { child.kill('SIGKILL'); } catch { /* já morto */ } }
  };
  // Trava de segurança: se nenhum system event vier, não deixa o processo vivo.
  const timer = setTimeout(finish, 30_000);
  timer.unref();

  // Um EPIPE/ECONNRESET no pipe (o finish() manda SIGKILL no grupo com a leitura em
  // voo) subiria como uncaughtException — e o backstop do index.ts derruba o backend
  // INTEIRO por causa de uma sonda opcional. Não basta tratar no stream: o readline
  // REEMITE o erro do input na própria Interface, e 'error' sem listener no
  // EventEmitter volta a ser throw. Os dois precisam de handler.
  // O stderr também precisa ser drenado: pipe não lido enche em ~64KB e trava o filho.
  child.stdout?.on('error', () => { clearTimeout(timer); finish(); });
  child.stderr?.on('error', () => {});
  child.stderr?.resume();

  const rl = createInterface({ input: child.stdout! });
  rl.on('error', () => { clearTimeout(timer); finish(); });
  rl.on('line', (line) => {
    const s = line.trim();
    if (!s) return;
    try {
      const ev = JSON.parse(s) as { type?: string; slash_commands?: unknown };
      if (ev.type === 'system' && Array.isArray(ev.slash_commands) && ev.slash_commands.length) {
        applySlashCommands(ev.slash_commands.filter((c): c is string => typeof c === 'string'));
        clearTimeout(timer);
        finish();
      }
    } catch { /* linha não-JSON: ignora */ }
  });
  child.on('error', () => { clearTimeout(timer); finish(); });
  child.on('close', () => { clearTimeout(timer); done = true; });
}
