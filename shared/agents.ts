// External agents (Grok, Gemini, Codex, OpenCode…) plugged into the Deck through
// ACP — the Agent Client Protocol: JSON-RPC over the agent CLI's stdin/stdout.
// Any CLI that speaks ACP becomes a "model" in the session picker, under the id
// `agent:<id>`, and runs on the login the CLI already has on the box (the
// SuperGrok subscription for Grok), never on a key the Deck holds.

export const AGENT_MODEL_PREFIX = 'agent:';
export const AGENT_ID_RE = /^[a-z][a-z0-9-]{0,31}$/;

export function agentModelId(id: string): string {
  return `${AGENT_MODEL_PREFIX}${id}`;
}

export function isAgentModel(model: string | undefined | null): boolean {
  return typeof model === 'string' && model.startsWith(AGENT_MODEL_PREFIX);
}

// ACP agents bill their own login. An unset model is a Claude turn.
export function billsClaudePlan(model: string | undefined | null): boolean {
  return !isAgentModel(model);
}

export function agentIdOf(model: string): string | null {
  if (!isAgentModel(model)) return null;
  const id = model.slice(AGENT_MODEL_PREFIX.length);
  return AGENT_ID_RE.test(id) ? id : null;
}

export type AgentCustomField = 'id' | 'name' | 'command' | 'args' | 'install' | 'login';

export type AgentStepKind = 'install' | 'login' | 'test';

export interface AgentStep {
  kind: AgentStepKind;
  title: string;
  what: string;
  command?: string;
}

// The commands that set a CLI up on the box. They are typed into the agent's own
// Deck terminal (a real shell), unlike `command`/`args`, which are spawned directly.
export interface AgentSetup {
  install?: string;
  login?: string;
}

export interface AgentPreset extends AgentSetup {
  id: string;
  name: string;
  vendor: string;
  source: 'closed' | 'open';
  blurb: string;
  command: string;
  args: string[];
  steps: AgentStep[];
  docs: string;
}

export interface AgentConfig extends AgentSetup {
  id: string;
  name: string;
  command: string;
  args: string[];
  preset?: string;
}

export type AgentStatus = 'ready' | 'needs-login' | 'not-installed' | 'error' | 'unknown';

export interface AgentView extends AgentConfig {
  status: AgentStatus;
  detail?: string;
  version?: string;
  checkedAt?: number;
}

export function agentSteps(setup: AgentSetup): AgentStep[] {
  return [
    { kind: 'install', title: 'Instalar', what: 'Baixa o programa do agente nesta VPS.', command: setup.install },
    { kind: 'login', title: 'Entrar', what: 'Liga o agente à sua conta. Confirme o link ou código que aparecer.', command: setup.login },
    { kind: 'test', title: 'Testar', what: 'Mando um oi pro agente. Respondeu, ele aparece no seletor de modelo.' },
  ];
}

const TERM_ID_MAX = 32;

export function agentTermId(id: string): string {
  return `agent-${id}`.slice(0, TERM_ID_MAX);
}

type PresetSeed = Omit<AgentPreset, 'steps'>;

const SEEDS: PresetSeed[] = [
  {
    id: 'grok',
    name: 'Grok',
    vendor: 'xAI',
    source: 'closed',
    blurb: 'Roda na sua assinatura SuperGrok / X Premium+, sem chave de API.',
    command: 'grok',
    args: ['agent', 'stdio'],
    // The installer adds ~/.grok/bin to ~/.bashrc, which the terminal shell that
    // ran it never re-reads: without the export the login step, typed into the
    // same shell, dies with "grok: command not found".
    install: 'curl -fsSL https://x.ai/cli/install.sh | bash && export PATH="$HOME/.grok/bin:$PATH"',
    login: 'grok login --device-auth',
    docs: 'https://docs.x.ai/build/overview',
  },
  {
    id: 'gemini',
    name: 'Gemini CLI',
    vendor: 'Google',
    source: 'open',
    blurb: 'Entra com conta Google (cota grátis) ou GEMINI_API_KEY.',
    command: 'gemini',
    args: ['--experimental-acp'],
    install: 'npm install -g @google/gemini-cli',
    login: 'gemini',
    docs: 'https://github.com/google-gemini/gemini-cli',
  },
  {
    id: 'codex',
    name: 'Codex',
    vendor: 'OpenAI',
    source: 'open',
    blurb: 'Usa o login do ChatGPT (Plus/Pro) ou OPENAI_API_KEY.',
    command: 'codex-acp',
    args: [],
    install: 'npm install -g @openai/codex @agentclientprotocol/codex-acp',
    login: 'codex login --device-auth',
    docs: 'https://github.com/agentclientprotocol/codex-acp',
  },
  {
    id: 'claude-code',
    name: 'Claude Code',
    vendor: 'Anthropic',
    source: 'closed',
    blurb: 'Claude Code pela ponte ACP. Usa o login do Claude que já existe na VPS.',
    command: 'claude-agent-acp',
    args: [],
    install: 'npm install -g @agentclientprotocol/claude-agent-acp',
    login: 'claude',
    docs: 'https://github.com/agentclientprotocol/claude-agent-acp',
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    vendor: 'SST',
    source: 'open',
    blurb: 'Fala com dezenas de provedores, inclusive modelos locais.',
    command: 'opencode',
    args: ['acp'],
    install: 'npm install -g opencode-ai',
    login: 'opencode auth login',
    docs: 'https://opencode.ai/docs/acp',
  },
];

export const AGENT_PRESETS: AgentPreset[] = SEEDS.map((s) => ({ ...s, steps: agentSteps(s) }));

export function presetById(id: string): AgentPreset | undefined {
  return AGENT_PRESETS.find((p) => p.id === id);
}
