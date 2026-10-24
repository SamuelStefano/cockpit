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

export function agentIdOf(model: string): string | null {
  if (!isAgentModel(model)) return null;
  const id = model.slice(AGENT_MODEL_PREFIX.length);
  return AGENT_ID_RE.test(id) ? id : null;
}

export interface AgentStep {
  title: string;
  command?: string;
  hint?: string;
}

export interface AgentPreset {
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

export interface AgentConfig {
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

const ACP_TEST_STEP: AgentStep = {
  title: 'Testar a conexão',
  hint: 'Clique em "Testar". Verde = pronto; o agente aparece no seletor de modelo de qualquer chat.',
};

export const AGENT_PRESETS: AgentPreset[] = [
  {
    id: 'grok',
    name: 'Grok',
    vendor: 'xAI',
    source: 'closed',
    blurb: 'Grok Build rodando na sua assinatura SuperGrok / X Premium+. Sem chave de API: cobra da assinatura, não por token.',
    command: 'grok',
    args: ['agent', 'stdio'],
    steps: [
      { title: 'Instalar o Grok CLI na VPS', command: 'curl -fsSL https://x.ai/cli/install.sh | bash' },
      {
        title: 'Entrar com a conta da assinatura',
        command: 'grok login --device-auth',
        hint: 'Rode num Terminal do Deck. Ele mostra um link e um código: abra no celular ou no PC, logado na conta do SuperGrok, e confirme. Se o teste falar em "Privacy Mode", rode `grok`, digite /privacy e escolha uma opção.',
      },
      ACP_TEST_STEP,
    ],
    docs: 'https://docs.x.ai/build/overview',
  },
  {
    id: 'gemini',
    name: 'Gemini CLI',
    vendor: 'Google',
    source: 'open',
    blurb: 'Agente open source do Google. Entra com conta Google (cota grátis) ou GEMINI_API_KEY.',
    command: 'gemini',
    args: ['--experimental-acp'],
    steps: [
      { title: 'Instalar o Gemini CLI', command: 'npm install -g @google/gemini-cli' },
      { title: 'Entrar com a conta Google', command: 'gemini', hint: 'Rode uma vez num Terminal do Deck e escolha "Login with Google".' },
      ACP_TEST_STEP,
    ],
    docs: 'https://github.com/google-gemini/gemini-cli',
  },
  {
    id: 'codex',
    name: 'Codex',
    vendor: 'OpenAI',
    source: 'open',
    blurb: 'Codex CLI pela ponte ACP da Zed. Usa o login do ChatGPT (Plus/Pro) ou OPENAI_API_KEY.',
    command: 'codex-acp',
    args: [],
    steps: [
      { title: 'Instalar o Codex e a ponte ACP', command: 'npm install -g @openai/codex @zed-industries/codex-acp' },
      { title: 'Entrar com a conta do ChatGPT', command: 'codex login --device-auth', hint: 'Rode num Terminal do Deck e confirme o código no navegador.' },
      ACP_TEST_STEP,
    ],
    docs: 'https://github.com/zed-industries/codex-acp',
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    vendor: 'SST',
    source: 'open',
    blurb: 'Agente open source que fala com dezenas de provedores (inclusive modelos locais).',
    command: 'opencode',
    args: ['acp'],
    steps: [
      { title: 'Instalar o OpenCode', command: 'npm install -g opencode-ai' },
      { title: 'Conectar um provedor', command: 'opencode auth login', hint: 'Rode num Terminal do Deck e escolha o provedor.' },
      ACP_TEST_STEP,
    ],
    docs: 'https://opencode.ai/docs/acp',
  },
];

export function presetById(id: string): AgentPreset | undefined {
  return AGENT_PRESETS.find((p) => p.id === id);
}
