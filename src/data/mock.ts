// Tipos de chat = fonte única em shared/protocol (re-export p/ os componentes).
// Aqui ficam só os tipos/seed de TERMINAL (Fase posterior ainda em mock).
export type {
  ToolCall, TextBlock, CodeBlock, ToolBlock, Block,
  UserMessage, AssistantMessage, Message,
} from '../../shared/protocol';

export interface Session {
  id: string;
  title: string;
  relative: string;
  snippet: string;
  hasTerminal: boolean;
  active: boolean;
}

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
