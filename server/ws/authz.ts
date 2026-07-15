import type { ClientMsg } from '../../shared/protocol';
import type { Role } from '../auth';

// Checkpoint único de autorização por papel (DR-011 Fase 2 / DR-014). ALLOWLIST,
// não blocklist: só o que está listado é permitido — default-deny. Um blocklist
// (o antigo isAdminOnly) falhava-ABERTO: qualquer `t` novo no protocolo nascia
// liberado pro student por esquecimento. Aqui capability nova só existe quando
// concedida de propósito. Hoje é inerte (token único → role 'admin', que recebe
// tudo); arma o corte real quando o role passar a sair do token por-usuário.
//
// student = só leitura + chat próprio. Sem terminal (term-* dá shell no host),
// sem admin-health (recon), sem mutação de metadados de sessão alheia
// (hide/unhide/purge/set-meta) nem listagem do arquivo (list-archived).
const STUDENT_ALLOWED: ReadonlySet<ClientMsg['t']> = new Set([
  'send', 'stop', 'ping', 'list', 'sync', 'open', 'open-full', 'search',
  'ctx-list', 'ctx-open', 'skill-list', 'skill-open', 'usage-list', 'upload', 'upload-chunk', 'att-open',
  'refresh-models', 'points-get',
]);

export function authorize(role: Role, t: ClientMsg['t']): boolean {
  if (role === 'admin') return true;
  return STUDENT_ALLOWED.has(t);
}
