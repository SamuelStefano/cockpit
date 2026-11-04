import { sanitizeBoxLabel } from '../../../shared/boxes';
// Lógica pura do onboarding de pareamento. O dashboard mostrava "aguardando o
// agente conectar…" pra sempre: o código de pareamento expira em 10min no relay e
// nada na tela dizia isso, então quem voltava meia hora depois colava um comando
// morto e via o mesmo spinner. Ponto de abandono #1 do backlog.

export type RelayProbe = 'unknown' | 'checking' | 'ok' | 'unreachable' | 'rejected';

// Quanto falta do código, em ms. Sem prazo conhecido devolve null (relay antigo
// não manda `expiresAt`) — aí a UI não inventa contagem nenhuma.
export function remainingMs(expiresAt: string | null, now: number): number | null {
  if (!expiresAt) return null;
  const at = Date.parse(expiresAt);
  if (!Number.isFinite(at)) return null;
  return Math.max(0, at - now);
}

export function isExpired(expiresAt: string | null, now: number): boolean {
  const left = remainingMs(expiresAt, now);
  return left !== null && left === 0;
}

// m:ss — o prazo é de minutos, então segundos soltos ("438s") não ajudam ninguém.
export function fmtCountdown(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export interface PairDiagnosis {
  tone: 'neutral' | 'orange' | 'green' | 'red' | 'yellow';
  title: string;
  // O que rodar NA VPS, em ordem. Diagnóstico sem comando é só um aviso bonito.
  steps: string[];
}

export interface DiagnoseInput {
  probe: RelayProbe;
  agentOnline: boolean;
  expired: boolean;
  hasCode: boolean;
}

const AGENT_STEPS = [
  'systemctl status deck-agent --no-pager',
  'journalctl -u deck-agent -n 50 --no-pager',
  'curl -sS https://deck-relay.devfellowship.com/status',
];

// Traduz o estado observável em algo acionável. A ordem importa: sem relay
// alcançável nada mais é diagnosticável, e um código expirado explica sozinho o
// silêncio do agente — mandar o usuário caçar log da VPS ali seria caça-fantasma.
export function diagnose({ probe, agentOnline, expired, hasCode }: DiagnoseInput): PairDiagnosis {
  if (agentOnline) {
    return { tone: 'green', title: 'Agente conectado — abrindo o Deck…', steps: [] };
  }
  if (probe === 'checking') {
    return { tone: 'neutral', title: 'Testando a conexão com o relay…', steps: [] };
  }
  if (probe === 'unreachable') {
    return {
      tone: 'red',
      title: 'Este navegador não alcança o relay. O problema está aqui, não na VPS.',
      steps: ['Confira sua rede/VPN e tente de novo', 'curl -sS https://deck-relay.devfellowship.com/status'],
    };
  }
  if (probe === 'rejected') {
    return {
      tone: 'red',
      title: 'O relay respondeu, mas recusou esta sessão. Saia e entre de novo.',
      steps: [],
    };
  }
  if (expired) {
    return {
      tone: 'yellow',
      title: 'O código expirou — o comando antigo não pareia mais. Gere um novo.',
      steps: [],
    };
  }
  if (!hasCode) {
    return { tone: 'neutral', title: 'Gerando um código de pareamento…', steps: [] };
  }
  if (probe === 'ok') {
    return {
      tone: 'orange',
      title: 'O relay está de pé e ninguém pareou ainda: o comando não rodou na VPS, ou o agente subiu e caiu.',
      steps: AGENT_STEPS,
    };
  }
  return { tone: 'neutral', title: 'Aguardando o agente conectar…', steps: [] };
}

export type InstallMode = 'isolated' | 'dedicated';

// An admin account pairs its OWN box: without DECK_AGENT_ROLE=admin the agent comes
// up as student and refuses terminals and external agents (Grok) on every turn.
// Isolated runs through sudo so the script can create the `deck` user; the agent
// itself never gets sudo.
export function shellSafeLabel(raw: string): string {
  return sanitizeBoxLabel(raw).replace(/["'`$\\!;&|<>(){}*?~#]/g, '').trim();
}

// Same line in cmd and PowerShell: `$env:X` inside the quotes would expand in one and
// not in the other, and `VAR=x` exists in neither, so the values go through stdin:
// code, device code, role, label. Only the charset-checked label is free text.
export function windowsSetupCommand(url: string, code: string, admin: boolean, label = '', deviceCode = ''): string {
  const device = /^[A-Z2-7]{52}$/.test(deviceCode) ? deviceCode : '-';
  const safe = shellSafeLabel(label).replace(/[^\p{L}\p{N} _.-]/gu, '');
  const line = [code, device, admin ? 'admin' : 'student', safe].filter(Boolean).join(' ');
  // Quoted: PowerShell's echo would put each bare word on its own line.
  return `echo "${line}"| powershell -NoProfile -ExecutionPolicy Bypass -Command "& ([scriptblock]::Create((irm ${url})))"`;
}

// The same command as a file: double-click, no terminal to open. CRLF, or cmd misreads
// labels. It holds a single-use code, so it deletes itself once the install succeeds.
export function windowsSetupFile(command: string): string {
  return [
    '@echo off',
    'chcp 65001 >nul',
    'title Installing Fleet',
    command,
    'if errorlevel 1 (',
    '  echo.',
    '  pause',
    '  exit /b 1',
    ')',
    'timeout /t 5 >nul',
    '(goto) 2>nul & del "%~f0"',
    '',
  ].join('\r\n');
}

// agent-setup.sh installs `deck-agent` with the box's own user, dirs and relay
// baked in, so the command is the same on every box and nothing is interpolated.
export const ENROLL_COMMAND = 'deck-agent enroll-device';

// Boxes installed before the wrapper existed (isolated mode: user `deck`).
export const LEGACY_ENROLL_COMMAND = "sudo -H -u deck env $(systemctl show deck-agent -p Environment --value) bash -c 'cd ~/.deck-src && npx tsx server/agent.ts --enroll-device'";

// deviceCode (passkey browsers): pre-authorizes this browser on the new box, so
// it opens the Deck without `--enroll-device`. Env like the pair code, never argv.
export function setupCommand(url: string, code: string, admin: boolean, mode: InstallMode = 'dedicated', label = '', deviceCode = ''): string {
  const safe = shellSafeLabel(label);
  const role = (admin ? 'DECK_AGENT_ROLE=admin ' : '') + (safe ? `DECK_BOX_LABEL="${safe}" ` : '');
  const device = /^[A-Z2-7]{52}$/.test(deviceCode) ? `DECK_DEVICE_CODE=${deviceCode} ` : '';
  if (mode === 'isolated') return `curl -fsSL ${url} | sudo DECK_ISOLATED=1 ${role}${device}DECK_PAIR_CODE=${code} bash`;
  return `curl -fsSL ${url} | ${role}${device}DECK_PAIR_CODE=${code} bash`;
}
