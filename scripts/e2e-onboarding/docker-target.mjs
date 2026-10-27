import { run, mustRun } from './exec.mjs';

export async function createDockerTarget({ runId, memory = '1g', image = 'ubuntu:24.04' }) {
  const name = `deck-e2e-${runId}`;
  return {
    kind: 'docker',
    systemd: false,
    async provision() {
      await mustRun('docker', ['run', '-d', '--name', name, `--memory=${memory}`, `--memory-swap=${memory}`, image, 'sleep', 'infinity'], { timeoutMs: 600_000 });
      return `container ${name} (${image}, memory ${memory})`;
    },
    exec(script, opts) {
      return run('docker', ['exec', '-i', name, 'bash', '-lc', script], opts);
    },
    async destroy() {
      await run('docker', ['rm', '-f', name]);
    },
  };
}
