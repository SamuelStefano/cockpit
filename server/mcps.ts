import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parseMcpList, type McpsState } from '../shared/mcps';
import { cliPath } from './engine/cli-path';

const run = promisify(execFile);

const LIST_TIMEOUT_MS = 60_000;

type Runner = (args: string[], timeoutMs: number) => Promise<string>;

const claude: Runner = async (args, timeout) => {
  const { stdout } = await run('claude', args, { timeout, env: { ...process.env, PATH: cliPath(), TERM: 'dumb' }, maxBuffer: 1024 * 1024 });
  return stdout;
};

export async function mcpsState(deps: { exec?: Runner } = {}): Promise<McpsState> {
  const exec = deps.exec ?? claude;
  try {
    return { servers: parseMcpList(await exec(['mcp', 'list'], LIST_TIMEOUT_MS)) };
  } catch (e) {
    return { servers: [], error: `não consegui rodar "claude mcp list": ${(e as Error).message.split('\n')[0]}` };
  }
}
