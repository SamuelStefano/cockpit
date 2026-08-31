// Roda os smokes de UI que dependem de `vite preview`, subindo e derrubando o
// preview sozinho. Sem isto cada smoke exigia um servidor a mais num terminal
// separado, então ninguém rodava e eles apodreciam calados: o smoke-play passou a
// falhar quando a aba padrão do /play virou "App" e o repo não percebeu.
//
//   npm run smoke:ui            # todos
//   npm run smoke:ui -- play ds # só esses
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const ALL = ['ds', 'play', 'share', 'studio'];
const pick = process.argv.slice(2);
const suites = pick.length ? pick : ALL;

const unknown = suites.filter((s) => !ALL.includes(s));
if (unknown.length) {
  console.error(`smoke desconhecido: ${unknown.join(', ')} (disponíveis: ${ALL.join(', ')})`);
  process.exit(2);
}

const PORT = Number(process.env.SMOKE_PORT ?? 4173);
const BASE = `http://localhost:${PORT}`;

const run = (cmd, args, env) => new Promise((resolve) => {
  const p = spawn(cmd, args, { stdio: 'inherit', env: { ...process.env, ...env } });
  p.on('close', (code) => resolve(code ?? 1));
});

// Um preview de outra rodada respondendo nesta porta serve um build ANTIGO: os
// smokes passariam verdes contra código que não é o do working tree. Como o
// --strictPort só faz o preview novo morrer (sem derrubar o runner), a checagem
// precisa vir antes.
if (await fetch(BASE).then(() => true).catch(() => false)) {
  console.error(`já tem algo servindo ${BASE} — derrube antes, ou use SMOKE_PORT=outra`);
  process.exit(1);
}

// `detached` põe o preview num grupo próprio pra poder matá-lo INTEIRO: o `npx`
// é só a casca e o vite roda como neto, então um kill no filho direto deixava o
// servidor vivo segurando a porta — o runner seguinte batia na guarda acima e
// ninguém sabia de quem era o processo.
const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  stdio: ['ignore', 'ignore', 'inherit'],
  detached: true,
});
let previewDied = false;
preview.on('close', () => { previewDied = true; });
// Um preview sobrevivente prende a porta e faz a próxima rodada morrer no
// --strictPort, então ele cai em qualquer saída — inclusive Ctrl-C.
const stop = () => { try { process.kill(-preview.pid, 'SIGTERM'); } catch { /* já morreu */ } };
process.on('exit', stop);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { stop(); process.exit(130); });

let up = false;
for (let i = 0; i < 40 && !up && !previewDied; i++) {
  up = await fetch(BASE).then((r) => r.ok).catch(() => false);
  if (!up) await sleep(250);
}
if (!up) {
  console.error(`preview não subiu em ${BASE} — rodou \`npm run build\` antes?`);
  stop();
  process.exit(1);
}

const failed = [];
for (const s of suites) {
  console.log(`\n═══ smoke-${s}`);
  if (await run('node', [`scripts/smoke-${s}.mjs`], { SMOKE_BASE: BASE })) failed.push(s);
}

stop();
console.log(failed.length ? `\nFALHOU: ${failed.join(', ')}` : `\nTODOS OK (${suites.length})`);
process.exit(failed.length ? 1 : 0);
