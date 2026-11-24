#!/usr/bin/env node
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createRecorder, writeReport } from './report.mjs';
import { createDockerTarget } from './docker-target.mjs';
import { createHetznerTarget } from './hetzner-target.mjs';
import { runInstallSteps, runPairStep } from './install-steps.mjs';
import { runBrowserSteps } from './browser-steps.mjs';

function parseArgs(argv) {
  const out = { target: 'docker', out: process.env.E2E_OUT_DIR ?? 'e2e-onboarding-runs', memory: '1g' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--target') out.target = argv[++i];
    else if (a === '--out') out.out = argv[++i];
    else if (a === '--memory') out.memory = argv[++i];
    else if (a === '--url') out.url = argv[++i];
    else if (a === '--skip-browser') out.skipBrowser = true;
    else if (a === '--help') out.help = true;
    else throw new Error(`unknown argument ${a}`);
  }
  if (!['docker', 'hetzner'].includes(out.target)) throw new Error(`unknown target ${out.target}`);
  return out;
}

async function startLocalDeck(port) {
  const p = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: false });
  const url = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch(url)).ok) return { url, stop: () => p.kill('SIGTERM') }; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  p.kill('SIGTERM');
  throw new Error('local vite did not start');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('usage: node scripts/e2e-onboarding/run.mjs [--target docker|hetzner] [--url DECK_URL] [--out DIR] [--memory 1g] [--skip-browser]\nenv: DECK_URL, DECK_E2E_EMAIL, DECK_E2E_PASSWORD, HCLOUD_TOKEN, HCLOUD_SERVER_TYPE, E2E_MAX_LIFETIME_MIN');
    return 0;
  }
  const startedAt = new Date().toISOString();
  const runId = startedAt.replace(/[:.]/g, '-').toLowerCase();
  const dir = join(args.out, runId);
  mkdirSync(dir, { recursive: true });
  const rec = createRecorder(dir);
  const notes = [];
  const target = args.target === 'hetzner' ? createHetznerTarget({ runId: runId.slice(0, 19) }) : await createDockerTarget({ runId: runId.slice(0, 19), memory: args.memory });
  let localDeck = null;
  let browserState = { pairCode: null };
  try {
    await rec.step(`Provision ${target.kind} target`, () => target.provision());
    if (rec.steps.at(-1).status === 'pass') {
      await runInstallSteps({ target, step: rec.step });
    } else {
      notes.push('Provisioning failed; install steps skipped.');
    }

    if (!args.skipBrowser) {
      const email = process.env.DECK_E2E_EMAIL;
      const password = process.env.DECK_E2E_PASSWORD;
      let url = args.url ?? process.env.DECK_URL;
      if (!url) {
        localDeck = await startLocalDeck(5197);
        url = localDeck.url;
        notes.push('DECK_URL not set: browser steps ran against a local vite dev server of this checkout, not the public Deck.');
      }
      browserState = await runBrowserSteps({ step: rec.step, dir, url, email, password });
      if (!email || !password) notes.push('DECK_E2E_EMAIL/DECK_E2E_PASSWORD not set: stopped after the public steps; real pairing not exercised.');
    }
    if (browserState.pairCode && rec.steps.every((s) => s.status === 'pass')) {
      await runPairStep({ target, step: rec.step, pairCode: browserState.pairCode });
    }
  } catch (e) {
    notes.push(`Runner error: ${e?.message ?? e}`);
  } finally {
    localDeck?.stop();
    await rec.step(`Destroy ${target.kind} target`, () => target.destroy());
    const path = writeReport(dir, { target: target.kind, startedAt, steps: rec.steps, notes });
    console.log(`[e2e] report: ${path}`);
  }
  return rec.steps.some((s) => s.status === 'fail') ? 1 : 0;
}

main().then((c) => process.exit(c), (e) => { console.error(e); process.exit(1); });
