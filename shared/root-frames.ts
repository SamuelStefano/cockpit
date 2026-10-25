import type { ClientMsg } from './protocol';

// Frames only the box owner (account role root) may send: the points/DFL finance
// ledger, the host write-ops (tokens, MCP, CLI, restart) and saving/probing a
// custom ACP agent (an arbitrary command the box spawns). A plain admin keeps
// the rest of the Painel. Enforced twice: the relay drops them for a non-root
// account (it is the only party that knows the account role, from the JWT), and
// the engine's authorize refuses them on a connection that is not the owner's.
// Pure, no node:* import: the relay and the server both use it.
export const ROOT_ONLY: ReadonlySet<ClientMsg['t']> = new Set<ClientMsg['t']>([
  'points-get', 'points-add', 'points-correct', 'points-note', 'points-delete',
  'points-dfl-get', 'points-dfl-sync', 'points-dfl-change', 'points-dfl-invoice',
  'pontos-agent-tasks', 'drafts-get', 'drafts-op',
  'admin-env-set', 'admin-env-unset', 'admin-mcp-add', 'admin-mcp-remove',
  'admin-cli-install', 'admin-cli-update', 'admin-deck-restart',
  'agent-add-custom', 'agent-probe-draft',
]);

// A frame whose own prefix says it belongs to the owner, even if a future one is
// added to the protocol without being listed above.
const ROOT_PREFIXES = ['points-', 'pontos-', 'drafts-', 'admin-env-', 'admin-mcp-', 'admin-cli-', 'admin-deck-'];

export function isRootOnly(t: string): boolean {
  return ROOT_ONLY.has(t as ClientMsg['t']) || ROOT_PREFIXES.some((p) => t.startsWith(p));
}

// Decides on the PARSED `t`: a substring check on the raw text is bypassed by a
// JSON escape (`"points-add"` parses to `points-add`). Unparseable text is
// not a frame the engine would act on either, so it is not root-only.
export function isRootOnlyFrame(raw: string): boolean {
  let t: unknown;
  try { t = (JSON.parse(raw) as { t?: unknown })?.t; } catch { return false; }
  return typeof t === 'string' && isRootOnly(t);
}
