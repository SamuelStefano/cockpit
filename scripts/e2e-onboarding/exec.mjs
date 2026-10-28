import { spawn } from 'node:child_process';

export function run(cmd, args, { timeoutMs = 600_000, input, env } = {}) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, ...env } });
    let out = '';
    const onData = (d) => { out += d; };
    p.stdout.on('data', onData);
    p.stderr.on('data', onData);
    const timer = setTimeout(() => { out += `\n[e2e] timeout after ${timeoutMs}ms`; p.kill('SIGKILL'); }, timeoutMs);
    p.on('close', (code) => { clearTimeout(timer); resolve({ code: code ?? 1, out }); });
    p.on('error', (e) => { clearTimeout(timer); resolve({ code: 1, out: out + String(e) }); });
    if (input) p.stdin.write(input);
    p.stdin.end();
  });
}

export async function mustRun(cmd, args, opts) {
  const r = await run(cmd, args, opts);
  if (r.code !== 0) throw new Error(`${cmd} ${args.join(' ').slice(0, 120)} exited ${r.code}\n${r.out.slice(-1500)}`);
  return r.out;
}
