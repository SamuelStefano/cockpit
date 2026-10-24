import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readJsonForWrite, writeJson } from '../admin-ops';
import { AGENT_ID_RE, presetById, type AgentConfig } from '../../shared/agents';

const DIR = join(homedir(), '.deck-agent');
export const AGENTS_FILE = join(DIR, 'agents.json');
const SESSIONS_FILE = join(DIR, 'agent-sessions.json');

interface AgentsFile { agents: AgentConfig[] }
// Deck session uuid → the agent's own session id. The Deck keys history, the
// sidebar and resume on a lowercase uuid; an ACP session id has no fixed shape.
export interface AgentSessionLink { agentId: string; acpSessionId: string }
type SessionsFile = Record<string, AgentSessionLink>;

// A command reaches spawn() with shell:false, but it still must not look like a
// flag or carry a path trick; args are passed verbatim, each capped.
const COMMAND_RE = /^[A-Za-z0-9_./-]{1,128}$/;
const ARG_RE = /^[^\0\n\r]{0,256}$/;

export function validAgent(a: unknown): a is AgentConfig {
  const x = a as AgentConfig;
  return !!x && typeof x === 'object'
    && typeof x.id === 'string' && AGENT_ID_RE.test(x.id)
    && typeof x.name === 'string' && x.name.trim().length > 0 && x.name.length <= 48
    && typeof x.command === 'string' && COMMAND_RE.test(x.command) && !x.command.startsWith('-')
    && Array.isArray(x.args) && x.args.length <= 16 && x.args.every((s) => typeof s === 'string' && ARG_RE.test(s));
}

function parseAgents(raw: unknown): AgentConfig[] {
  const list = (raw as AgentsFile | null)?.agents;
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: AgentConfig[] = [];
  for (const a of list) {
    if (!validAgent(a) || seen.has(a.id)) continue;
    seen.add(a.id);
    out.push({ id: a.id, name: a.name.trim(), command: a.command, args: [...a.args], preset: typeof a.preset === 'string' ? a.preset : undefined });
  }
  return out;
}

// Sync on purpose: the models frame and run() are sync paths. The file is tiny.
export function listAgentsSync(): AgentConfig[] {
  try { return parseAgents(JSON.parse(readFileSync(AGENTS_FILE, 'utf8'))); } catch { return []; }
}

export function findAgent(id: string): AgentConfig | undefined {
  return listAgentsSync().find((a) => a.id === id);
}

// Read-modify-write of a shared file: two turns ending together would each
// write back their own copy and drop the other's entry.
let chain: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.catch(() => {});
  return next;
}

function saveAgents(mutate: (list: AgentConfig[]) => AgentConfig[]): Promise<void> {
  return serial(async () => {
    const cur = await readJsonForWrite<AgentsFile>(AGENTS_FILE, { agents: [] });
    await writeJson(AGENTS_FILE, { agents: mutate(parseAgents(cur)) });
  });
}

export async function connectPreset(presetId: string): Promise<{ ok: boolean; message: string }> {
  const p = presetById(presetId);
  if (!p) return { ok: false, message: 'agente desconhecido' };
  await saveAgents((list) => [...list.filter((a) => a.id !== p.id), { id: p.id, name: p.name, command: p.command, args: p.args, preset: p.id }]);
  return { ok: true, message: `${p.name} conectado — agora clique em Testar` };
}

export async function addCustomAgent(a: AgentConfig): Promise<{ ok: boolean; message: string }> {
  const agent = { id: a.id, name: a.name, command: a.command, args: a.args };
  if (!validAgent(agent)) return { ok: false, message: 'dados inválidos (id, nome, comando ou argumentos)' };
  if (presetById(agent.id)) return { ok: false, message: `"${agent.id}" é um agente pronto — use Conectar` };
  await saveAgents((list) => [...list.filter((x) => x.id !== agent.id), agent]);
  return { ok: true, message: `${agent.name} adicionado — agora clique em Testar` };
}

export async function removeAgent(id: string): Promise<{ ok: boolean; message: string }> {
  await saveAgents((list) => list.filter((a) => a.id !== id));
  return { ok: true, message: 'agente removido' };
}

export function sessionLinkSync(deckSessionId: string): AgentSessionLink | undefined {
  try {
    const all = JSON.parse(readFileSync(SESSIONS_FILE, 'utf8')) as SessionsFile;
    const l = all?.[deckSessionId];
    return l && typeof l.agentId === 'string' && typeof l.acpSessionId === 'string' ? l : undefined;
  } catch { return undefined; }
}

export function saveSessionLink(deckSessionId: string, link: AgentSessionLink): Promise<void> {
  return serial(async () => {
    const cur = await readJsonForWrite<SessionsFile>(SESSIONS_FILE, {});
    await writeJson(SESSIONS_FILE, { ...cur, [deckSessionId]: link });
  });
}
