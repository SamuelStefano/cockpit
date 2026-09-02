// Papel do ENGINE (authz de mensagens dentro de um processo). Distinto do papel
// de CONTA do relay (shared/identity.ts: root/admin/fellow, derivado do JWT).
//
// Quem fixa o papel é o TRANSPORTE, nunca um token por-usuário aqui:
// - modo listen (server/ws.ts, loopback :7777): sempre 'admin'. O único ator que
//   alcança a porta é o dono da box; COCKPIT_TOKEN é um gate de entrada (tokenAllowed),
//   não uma identidade — todo token que passa é o mesmo token.
// - modo dial (server/agent.ts, relay T3): DECK_AGENT_ROLE, um processo por conta.
// Uma segunda conta entra pelo relay (um agente por conta), não por um mapa
// token→papel no listen — o isolamento é o processo/HOME, não a allowlist.
export type Role = 'admin' | 'student';

// Capabilities anunciadas pra conexão no connect. canBypass espelha o gate do
// engine (bypassAllowed): só true com flag de servidor + admin + deploy
// local-confiável. A UI usa isto pra decidir se mostra o switch — mas o servidor
// reimpõe no run. localOnly (DR-017 fato 2) substitui o literal host==='127.0.0.1':
// a intenção é "este deploy é a box do dono", não o bind em si.
export function capsFor(role: Role, cfg: { allowBypass: boolean; localOnly: boolean }): { role: Role; canBypass: boolean } {
  return { role, canBypass: role === 'admin' && cfg.allowBypass === true && cfg.localOnly === true };
}
