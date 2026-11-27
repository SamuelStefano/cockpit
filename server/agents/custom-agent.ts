import { constants, promises as fs } from 'node:fs';
import { delimiter, isAbsolute, join, normalize } from 'node:path';
import { AGENT_ID_RE, presetById, type AgentConfig, type AgentCustomField } from '../../shared/agents';
import { agentEnv } from './acp-run';
import { probeAgent, type ProbeResult } from './probe';
import { SETUP_RE, addCustomAgent } from './store';

export type CustomField = AgentCustomField;

export interface CustomAgentInput {
  id: unknown;
  name: unknown;
  command: unknown;
  args: unknown;
  install?: unknown;
  login?: unknown;
}

export type CustomCheck =
  | { ok: true; agent: AgentConfig; resolved: string }
  | { ok: false; field: CustomField; message: string };

// The command is spawned with shell:false, so these are not an injection guard
// on their own: they keep the stored config boring enough to read at a glance
// and refuse anything that only makes sense to a shell (globs, $VARS, pipes).
const BARE_COMMAND_RE = /^[A-Za-z0-9_][A-Za-z0-9_.+-]{0,63}$/;
const ABS_COMMAND_RE = /^\/[A-Za-z0-9_.+/-]{1,255}$/;
const ARG_RE = /^[A-Za-z0-9_@%+=:,./-]{1,256}$/;
const NAME_RE = /^[^\x00-\x1f\x7f]{1,48}$/;
const MAX_ARGS = 16;

const fail = (field: CustomField, message: string): CustomCheck => ({ ok: false, field, message });

async function isExecutableFile(path: string): Promise<boolean> {
  try {
    const st = await fs.stat(path);
    if (!st.isFile()) return false;
    await fs.access(path, constants.X_OK);
    return true;
  } catch { return false; }
}

// Resolves against the PATH the agent is actually spawned with (agentEnv), not
// the Deck's own: that is where `spawn(command)` will look on every turn.
export async function resolveExecutable(command: string, pathVar = agentEnv().PATH ?? ''): Promise<string | null> {
  if (isAbsolute(command)) return (await isExecutableFile(command)) ? command : null;
  for (const dir of pathVar.split(delimiter)) {
    if (!dir || !isAbsolute(dir)) continue;
    const candidate = join(dir, command);
    if (await isExecutableFile(candidate)) return candidate;
  }
  return null;
}

function setupField(v: unknown, field: 'install' | 'login'): string | undefined | CustomCheck {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'string') return fail(field, 'precisa ser texto');
  const t = v.trim();
  if (!t) return undefined;
  return SETUP_RE.test(t) ? t : fail(field, 'uma linha só, até 300 caracteres');
}

export async function checkCustomAgent(input: CustomAgentInput, pathVar?: string): Promise<CustomCheck> {
  const id = typeof input.id === 'string' ? input.id.trim() : '';
  if (!AGENT_ID_RE.test(id)) return fail('id', 'use minúsculas, números e hífen, começando por letra (até 32)');
  if (presetById(id)) return fail('id', `"${id}" já é um agente pronto: use Adicionar no cartão dele`);

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!NAME_RE.test(name)) return fail('name', 'dê um nome de até 48 caracteres');

  const command = typeof input.command === 'string' ? input.command.trim() : '';
  if (!command) return fail('command', 'informe o executável');
  const absolute = command.startsWith('/');
  if (absolute ? !ABS_COMMAND_RE.test(command) || normalize(command) !== command : !BARE_COMMAND_RE.test(command)) {
    return fail('command', 'só o nome do executável (ex. gemini) ou um caminho absoluto, sem espaços nem símbolos de shell');
  }

  if (!Array.isArray(input.args) || input.args.length > MAX_ARGS) return fail('args', `até ${MAX_ARGS} argumentos`);
  const args: string[] = [];
  for (const a of input.args) {
    if (typeof a !== 'string' || !ARG_RE.test(a)) {
      return fail('args', `argumento inválido: ${JSON.stringify(String(a)).slice(0, 40)} — sem espaços, aspas nem símbolos de shell`);
    }
    args.push(a);
  }

  const install = setupField(input.install, 'install');
  if (typeof install === 'object') return install;
  const login = setupField(input.login, 'login');
  if (typeof login === 'object') return login;

  const resolved = await resolveExecutable(command, pathVar);
  if (!resolved) {
    return fail('command', absolute
      ? `${command} não existe ou não é executável`
      : `\`${command}\` não está instalado nesta VPS — rode o comando de instalar no terminal e tente de novo`);
  }
  return {
    ok: true,
    resolved,
    agent: { id, name, command, args, ...(install ? { install } : {}), ...(login ? { login } : {}) },
  };
}

export async function saveCustomAgent(input: CustomAgentInput): Promise<{ ok: boolean; message: string; field?: CustomField }> {
  const c = await checkCustomAgent(input);
  if (!c.ok) return { ok: false, message: c.message, field: c.field };
  return addCustomAgent(c.agent);
}

export async function probeDraft(input: CustomAgentInput): Promise<ProbeResult & { field?: CustomField }> {
  const c = await checkCustomAgent(input);
  if (!c.ok) return { status: 'error', message: c.message, field: c.field };
  return probeAgent(c.agent, 'funcionou, pode salvar');
}

// A custom agent is an arbitrary command the box spawns on every turn — the same
// RCE class as an MCP stdio. The engine half of the gate: an admin connection on
// a deploy that is the owner's own box. The relay half drops these frames for any
// account that is not root, and authorize refuses them off the owner connection
// (shared/root-frames.ts).
export function customAgentDenial(role: string | undefined, localOnly: boolean): string | null {
  if (role !== 'admin') return 'só a conta root adiciona agente personalizado';
  if (!localOnly) return 'este Deck não está marcado como a máquina do dono (COCKPIT_LOCAL_ONLY) — edite ~/.deck-agent/agents.json na VPS';
  return null;
}
