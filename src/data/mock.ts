export interface Session {
  id: string;
  title: string;
  relative: string;
  snippet: string;
  hasTerminal: boolean;
  active: boolean;
}

export interface ToolCall {
  name: string;
  label: string;
  command: string;
  status: 'running' | 'done' | 'error';
  durationMs?: number;
  exit?: number;
  expanded?: boolean;
  output: string[];
}

export interface TextBlock {
  type: 'text';
  md: string;
}

export interface CodeBlock {
  type: 'code';
  lang: string;
  code: string;
}

export interface ToolBlock {
  type: 'tool';
  tool: ToolCall;
}

export type Block = TextBlock | CodeBlock | ToolBlock;

export interface UserMessage {
  id: string;
  role: 'user';
  text: string;
}

export interface AssistantMessage {
  id: string;
  role: 'assistant';
  blocks: Block[];
}

export type Message = UserMessage | AssistantMessage;

export interface TerminalLine {
  t: 'sys' | 'cmd' | 'out' | 'ok' | 'warn' | 'err';
  s: string;
}

export interface Terminal {
  id: string;
  name: string;
  running: boolean;
  pid: number | null;
  cwd: string;
  lines: TerminalLine[];
}

export type ConnState = 'connected' | 'reconnecting' | 'down';

export const SESSIONS_SEED: Session[] = [
  {
    id: 's1',
    title: 'Debugar erro de git push rejected',
    relative: '2min atrás',
    snippet: 'O remote tem commits que você não tem localmente…',
    hasTerminal: true,
    active: true,
  },
  {
    id: 's2',
    title: 'Configurar deploy automático na VPS',
    relative: '1h atrás',
    snippet: 'Adicionei o webhook do GitHub e o systemd service…',
    hasTerminal: true,
    active: false,
  },
  {
    id: 's3',
    title: 'Migration do Postgres travando',
    relative: 'ontem',
    snippet: 'O lock na tabela users vem de uma transação aberta.',
    hasTerminal: false,
    active: false,
  },
];

export const CHAT_SEED: Message[] = [
  {
    id: 'm1',
    role: 'user',
    text: 'fiz git push e deu rejected, non-fast-forward. já tentei de novo e nada. o que faço sem perder meu commit local?',
  },
  {
    id: 'm2',
    role: 'assistant',
    blocks: [
      {
        type: 'text',
        md: 'Esse erro acontece quando o **remote tem commits que você ainda não tem** localmente — o git se recusa a sobrescrever o histórico. Vou checar o estado do seu repo antes de sugerir qualquer coisa.',
      },
      {
        type: 'tool',
        tool: {
          name: 'run_shell',
          label: 'Inspecionar estado do repositório',
          command: 'git status -sb && git log --oneline -3 origin/main',
          status: 'done',
          durationMs: 820,
          exit: 0,
          expanded: true,
          output: [
            '## main...origin/main [ahead 1, behind 2]',
            ' M src/api/auth.ts',
            '?? notes.md',
            '',
            'a1f3c0d (origin/main) fix: validar payload do webhook',
            '7e9b21a chore: bump deps de seguranca',
            'c004e88 feat: rate limit no login',
          ],
        },
      },
      {
        type: 'text',
        md: 'Confirmado: você está **1 commit à frente e 2 atrás** do `origin/main`. Alguém (ou outro deploy) empurrou dois commits enquanto você trabalhava. A correção segura é trazer o histórico remoto com `--rebase`, que reaplica seu commit *por cima* dos novos — sem merge bagunçado e sem perder nada.\n\nRode assim:',
      },
      {
        type: 'code',
        lang: 'bash',
        code: 'git pull --rebase origin main\n# resolva conflitos se aparecerem, depois:\ngit push origin main',
      },
      {
        type: 'text',
        md: 'Você tem uma mudança não-commitada em `auth.ts`. Quer que eu faça `git stash` antes do rebase pra não dar conflito no meio do caminho?',
      },
    ],
  },
];

export const TERMINALS_SEED: Terminal[] = [
  {
    id: 't1',
    name: 'api ~ logs',
    running: true,
    pid: 3421,
    cwd: '~/apps/api',
    lines: [
      { t: 'sys', s: 'Connected to vps-fra-01 · 2 vCPU · 4 GB' },
      { t: 'cmd', s: 'pnpm dev --filter api' },
      { t: 'out', s: '> api@1.4.0 dev' },
      { t: 'out', s: '> tsx watch src/index.ts' },
      { t: 'ok',  s: '✓ server pronto em http://0.0.0.0:8080' },
      { t: 'out', s: '12:04:51 GET  /health 200 1.2ms' },
      { t: 'out', s: '12:04:53 POST /auth/login 200 41ms' },
      { t: 'warn', s: '12:04:55 WARN rate-limit: 8/10 para 187.4.x.x' },
      { t: 'out', s: '12:04:58 GET  /v1/sessions 200 6ms' },
      { t: 'out', s: '12:05:02 POST /webhook/github 200 18ms' },
    ],
  },
  {
    id: 't2',
    name: 'db ~ psql',
    running: false,
    pid: null,
    cwd: '~/apps/api',
    lines: [
      { t: 'cmd', s: 'psql $DATABASE_URL' },
      { t: 'out', s: 'psql (16.2)' },
      { t: 'out', s: 'Type "help" for help.' },
      { t: 'out', s: '' },
      { t: 'out', s: 'app=# select count(*) from sessions;' },
      { t: 'out', s: ' count ' },
      { t: 'out', s: '-------' },
      { t: 'out', s: '   142' },
      { t: 'out', s: '(1 row)' },
      { t: 'sys', s: 'processo encerrado · exit 0' },
    ],
  },
];

export const STREAM_REPLY =
  'Boa. Antes de mexer no histórico, deixa eu salvar sua mudança local com stash e conferir se o rebase aplica limpo.';

export const STREAM_TOOL: ToolCall = {
  name: 'run_shell',
  label: 'Stash + rebase a seco',
  command: 'git stash push -m "wip auth" && git pull --rebase origin main',
  status: 'done',
  output: [
    'Saved working directory and index state WIP on main: 7e9b21a',
    'Successfully rebased and updated refs/heads/main.',
  ],
};

export const STREAM_REPLY_TAIL =
  ' Pronto — rebase aplicou sem conflito e seu commit foi reescrito por cima do remoto. Sua mudança em `auth.ts` está no stash; rodo `git stash pop` e depois o push?';

export const EXTRA_THREADS: Record<string, Message[]> = {
  s2: [
    { id: 's2m1', role: 'user', text: 'consegui fazer o deploy automático funcionar com webhook?' },
    {
      id: 's2m2',
      role: 'assistant',
      blocks: [
        { type: 'text', md: 'Sim — o `systemd` está escutando o webhook do GitHub e roda `git pull` + `pnpm build` a cada push na `main`. O último deploy foi há 1h e subiu limpo.' },
      ],
    },
  ],
  s3: [
    { id: 's3m1', role: 'user', text: 'a migration do postgres tá travada faz 10min' },
    {
      id: 's3m2',
      role: 'assistant',
      blocks: [
        { type: 'text', md: 'O lock vem de uma **transação aberta** segurando a tabela `users`. Dá pra ver quem é o bloqueador com `pg_locks`. Quer que eu liste as queries ativas?' },
      ],
    },
  ],
};
