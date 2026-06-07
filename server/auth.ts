// Seam de identidade (DR-011, Fase 1). Hoje o app é single-user em loopback: o
// único ator que alcança 127.0.0.1:7777 É o dono, então currentRole() devolve
// 'admin' constante. NÃO há contas/token ainda — o squad cravou que construir
// multi-tenant agora é prematuro (zero segundo ator) E insuficiente (student só
// roda com seguro num host isolado, fora desta box com prod). Esta função é o
// gancho da Fase 2: quando houver token no handshake do WS, o role passa a sair
// do token (por conexão), sem reescrever o engine — o gate de bypass já consulta
// o role aqui.
export type Role = 'admin' | 'student';

export function currentRole(): Role {
  return 'admin';
}
