import type { ClientMsg } from '../../shared/protocol';
import type { Role } from '../auth';
import { isRootOnly } from '../../shared/root-frames';

// Checkpoint único de autorização por papel (DR-011 Fase 2 / DR-014). ALLOWLIST,
// não blocklist: só o que está listado é permitido — default-deny. Um blocklist
// (o antigo isAdminOnly) falhava-ABERTO: qualquer `t` novo no protocolo nascia
// liberado pro student por esquecimento. Aqui capability nova só existe quando
// concedida de propósito. Hoje é inerte (token único → role 'admin', que recebe
// tudo); arma o corte real quando o role passar a sair do token por-usuário.
//
// student = limita a superfície do DECK, não o LLM: sem PTY direto (term-* é shell
// cru, fora do permission-model do CLI), sem admin-* (escreve ~/.claude.json,
// env.json, instala CLI, reinicia), sem bypass, sem mutação de metadados de sessão
// alheia (hide/unhide/purge/set-meta) nem listagem do arquivo (list-archived).
// `send` continua rodando tools (Bash/Write inclusive) NA BOX DO AGENTE — a
// contenção real é um processo/HOME por conta (server/auth.ts), não esta lista.
const STUDENT_ALLOWED: ReadonlySet<ClientMsg['t']> = new Set([
  'send', 'stop', 'ping', 'list', 'sync', 'open', 'open-full', 'search',
  'ctx-list', 'ctx-open', 'skill-list', 'skill-open', 'usage-list', 'upload-chunk', 'att-open',
  'refresh-models', 'plan-usage-get', 'grok-usage-get',
  // Read-only report about the box, and one cheap prompt through the same path as 'send'.
  'box-health-get', 'box-smoke-test',
  // Logs in the box's own CLI with a code only the human holds: no privilege gained.
  'claude-login-start', 'claude-login-code', 'claude-login-cancel',
  // Read-only `claude mcp list`.
  'mcps-get',
  // Read-only identity, not the admin-gated canvas-get graph build — needed
  // for the normal chat view's "this is the Orchestrator" banner.
  'orchestrator-get',
  'queue-add', 'queue-remove', 'queue-edit', 'queue-move', 'queue-clear', 'queue-get', 'queue-set-paused',
  // Só antecipa um item que o próprio student enfileirou: o dispatch passa o role
  // adiante e takeParked recusa item de admin (herdaria bypass).
  'queue-run-bg',
  // Só reordena e interrompe: o item continua rodando com o role de quem o
  // enfileirou, e 'stop' o student já tem. Não concede privilégio novo.
  'queue-run-now',
  // Equipe (fatia E): the dispatch coerces every bot a non-admin saves to the
  // restricted profile and limits the cron frames to bot routines
  // (ws/student-team.ts) — the frame alone grants no Bash.
  'team-get', 'team-save', 'team-delete',
  // Text-only one-shot with no tools (ws/agent-build.ts); one in flight per socket.
  'agent-build',
  // Text in, mp3 out, no tools and no state; same level as sending a chat message.
  'tts',
  'crons-get', 'cron-save', 'cron-delete', 'cron-run',
  // Read-only, limited to a bot in this account's team.json and to that bot's
  // workspace after realpath (ws/team-files-frames.ts, team-files.ts).
  'team-files-get', 'team-file-get',
  // Counts/cwd/state of that bot. Pane preview is emptied for student in
  // sendBotComputer; taking over is term-* (admin-only).
  'team-computer-get',
]);

// `root` = this connection is the box owner's (listen mode, or the owner's dial
// agent behind a relay that already dropped these frames for non-root accounts).
// Default false: a caller that forgets it denies the owner frames.
export function authorize(role: Role, t: ClientMsg['t'], root = false): boolean {
  if (isRootOnly(t) && !root) return false;
  if (role === 'admin') return true;
  return STUDENT_ALLOWED.has(t);
}
