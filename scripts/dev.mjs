import { spawn } from 'node:child_process';

// Roda backend (tsx watch) + frontend (vite) juntos, com saída prefixada.
// Dep-free de propósito (sem concurrently). Ctrl-C derruba os dois.
const procs = [
  { name: 'server', color: '\x1b[36m', cmd: 'npm', args: ['run', 'dev:server'] },
  { name: 'vite  ', color: '\x1b[33m', cmd: 'npm', args: ['run', 'dev:web'] },
];

const children = procs.map(({ name, color, cmd, args }) => {
  const child = spawn(cmd, args, { stdio: ['inherit', 'pipe', 'pipe'], env: process.env });
  const tag = (line) => `${color}[${name}]\x1b[0m ${line}`;
  const pipe = (stream) => {
    let buf = '';
    stream.on('data', (d) => {
      buf += d;
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        process.stdout.write(tag(buf.slice(0, nl)) + '\n');
        buf = buf.slice(nl + 1);
      }
    });
  };
  pipe(child.stdout);
  pipe(child.stderr);
  return child;
});

const killAll = () => children.forEach((c) => { try { c.kill('SIGTERM'); } catch { /* noop */ } });
process.on('SIGINT', () => { killAll(); process.exit(0); });
process.on('SIGTERM', () => { killAll(); process.exit(0); });
children.forEach((c) => c.on('exit', (code) => { if (code) { killAll(); process.exit(code); } }));
