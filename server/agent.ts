import { agentDir, checkBootAfterUpdate, realBootDeps } from './self-update-boot';

// Entry point of the relay agent (`tsx server/agent.ts`, the path installed units
// run). Kept free of app imports: ESM links the whole static graph before running
// any of it, so a self-update that broke any module must still find this check
// running first. The agent itself lives in agent-main.ts.

const LOCAL_ONLY = /^--(pair(=|$)|enroll-device$|devices$|revoke-device=)/;

if (process.argv[1]?.endsWith('agent.ts')) {
  if (!process.argv.slice(2).some((a) => LOCAL_ONLY.test(a))) {
    checkBootAfterUpdate(realBootDeps(process.cwd()), agentDir());
  }
  import('./agent-main')
    .then((m) => m.main())
    .catch((e) => { console.error('[agent] failed to load:', e); process.exit(1); });
}
