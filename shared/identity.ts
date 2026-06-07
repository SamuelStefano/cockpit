// Modelo de identidade de CONTA do relay T3 (DR-023). Distinto do `Role` do engine
// (admin/student em server/auth.ts), que governa a authz de mensagens DENTRO de um
// agente. Aqui é o papel da CONTA no produto multi-fellow, derivado SEMPRE no
// servidor a partir do email do JWT verificado — nunca do cliente (red line #1).
// types-only / puro: zero import de node:*; relay e frontend importam.

export type AccountRole = 'root' | 'admin' | 'fellow';

// Resolve o papel da conta. Ordem importa: root vence admin vence fellow.
// - root: email na allowlist de ENV do relay (COCKPIT_ROOT_EMAILS) — NUNCA flag de
//   banco, pra comprometer o DB não criar root (decisão do Samuel, DR-016).
// - admin: flag `account.is_admin`, setada SÓ por root via service-path.
// - fellow: default, e o fallback de segurança quando a identidade falha
//   (email ausente/JWT inválido) — default-deny pro menor privilégio (red line #10).
export function roleFromIdentity(
  email: string | null | undefined,
  isAdmin: boolean,
  rootEmails: ReadonlySet<string>,
): AccountRole {
  if (!email) return 'fellow';
  if (rootEmails.has(email.trim().toLowerCase())) return 'root';
  if (isAdmin === true) return 'admin';
  return 'fellow';
}

// Parseia a allowlist de root do ENV (CSV), normalizando case/espaços. Vira o
// Set passado pra roleFromIdentity. Vazio = nenhum root (default-deny).
export function parseRootEmails(csv: string | undefined): Set<string> {
  return new Set(
    (csv ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

// Conveniências de autorização de conta (governam o relay, não o engine):
// só root concede/revoga admin; root e admin veem todas as contas; fellow só a sua.
export function canGrantAdmin(role: AccountRole): boolean {
  return role === 'root';
}
export function canSeeAllAccounts(role: AccountRole): boolean {
  return role === 'root' || role === 'admin';
}
