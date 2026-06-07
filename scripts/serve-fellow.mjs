// Launcher "1 comando" pra um fellow subir o Deck na PRÓPRIA VPS (Fase 0b, DR-017).
// Objetivo: simples E seguro-por-padrão. Diferente de `npm run serve` cru, este:
//   1. Confere que o `claude` CLI está no PATH (sem ele o app é mudo — não spawna).
//   2. EXIGE um token; se COCKPIT_TOKEN não vier, gera um forte e imprime. Assim o
//      app NUNCA sobe aberto (fail-open admin) num tailnet/host exposto.
//   3. Builda o dist/ se faltar ou estiver mais velho que o fonte.
//   4. Sobe o server (front + WS na mesma porta), imprimindo a URL com ?token=.
// Dep-free de propósito (segue scripts/dev.mjs).
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, statSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const C = { cyan: '\x1b[36m', yellow: '\x1b[33m', red: '\x1b[31m', green: '\x1b[32m', dim: '\x1b[2m', reset: '\x1b[0m' };
const log = (m) => process.stdout.write(m + '\n');

// 1. Preflight: claude no PATH? (Agent 5 Crit: app é mudo sem ele.)
const claude = spawnSync('claude', ['--version'], { encoding: 'utf8' });
if (claude.status !== 0) {
  log(`${C.red}✗ 'claude' não encontrado no PATH.${C.reset}`);
  log(`  O Deck spawna 'claude -p' pra conversar — sem o CLI autenticado, o chat não funciona.`);
  log(`  Instale + faça login: ${C.cyan}https://docs.anthropic.com/claude-code${C.reset}`);
  process.exit(1);
}
log(`${C.green}✓${C.reset} claude CLI: ${claude.stdout.trim()}`);

// 2. Token obrigatório. Sem ele, gera e imprime (não sobe aberto).
let token = process.env.COCKPIT_TOKEN?.trim();
let generated = false;
if (!token) {
  token = randomBytes(24).toString('base64url');
  generated = true;
}

// 3. Build se dist/ faltar ou estiver stale vs fonte.
const dist = join(ROOT, 'dist');
const distIndex = join(dist, 'index.html');
const needsBuild = !existsSync(distIndex) || isStale(distIndex);
if (needsBuild) {
  log(`${C.yellow}⚙${C.reset}  Buildando o front (dist/ ${existsSync(distIndex) ? 'desatualizado' : 'ausente'})…`);
  const b = spawnSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' });
  if (b.status !== 0) { log(`${C.red}✗ build falhou.${C.reset}`); process.exit(1); }
} else {
  log(`${C.green}✓${C.reset} dist/ atualizado`);
}

// 4. Sobe o server com o token no env.
const port = process.env.COCKPIT_PORT ?? '7777';
log('');
log(`${C.green}● Deck no ar${C.reset} — front + WS em 127.0.0.1:${port}`);
log(`${C.dim}  (loopback; exponha via Tailscale ou túnel TLS pra um fellow acessar)${C.reset}`);
if (generated) {
  log('');
  log(`${C.yellow}Token gerado (guarde — é a identidade de acesso):${C.reset}`);
  log(`  ${C.cyan}COCKPIT_TOKEN=${token}${C.reset}`);
  log(`${C.dim}  Reuse com COCKPIT_TOKEN=… npm run fellow pra manter o mesmo token.${C.reset}`);
}
log('');
log(`${C.green}Acesse:${C.reset} http://127.0.0.1:${port}/?token=${token}`);
log('');

const child = spawn('npx', ['tsx', 'server/index.ts'], {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, COCKPIT_TOKEN: token, COCKPIT_PORT: port },
});
const stop = () => { try { child.kill('SIGTERM'); } catch { /* noop */ } };
process.on('SIGINT', () => { stop(); process.exit(0); });
process.on('SIGTERM', () => { stop(); process.exit(0); });
child.on('exit', (code) => process.exit(code ?? 0));

// dist/index.html mais velho que qualquer fonte em src/ ou index.html? => stale.
function isStale(indexPath) {
  try {
    const built = statSync(indexPath).mtimeMs;
    const srcRoot = join(ROOT, 'src');
    let newest = existsSync(join(ROOT, 'index.html')) ? statSync(join(ROOT, 'index.html')).mtimeMs : 0;
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else newest = Math.max(newest, statSync(p).mtimeMs);
      }
    };
    if (existsSync(srcRoot)) walk(srcRoot);
    return newest > built;
  } catch { return true; }
}
