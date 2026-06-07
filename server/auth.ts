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

// Deriva o papel da conexão a partir do token do handshake (DR-011 Fase 2 /
// DR-014). Single-account hoje: o token configurado é do dono → 'admin'; qualquer
// outra coisa → 'student' (sem capabilities perigosas). É o seam pra um mapa
// token→role no futuro, sem reescrever o roteador. O compare em si NÃO é o gate
// de auth (esse já rodou em tempo constante no upgrade do WS via tokenAllowed);
// aqui é só atribuição de papel pós-autenticação.
export function roleFromToken(expected: string, got: string | null): Role {
  return expected !== '' && got === expected ? 'admin' : 'student';
}

// Capabilities anunciadas pra conexão no connect. canBypass espelha o gate do
// engine (bypassAllowed): só true com flag de servidor + admin + deploy
// local-confiável. A UI usa isto pra decidir se mostra o switch — mas o servidor
// reimpõe no run. localOnly (DR-017 fato 2) substitui o literal host==='127.0.0.1':
// a intenção é "este deploy é a box do dono", não o bind em si.
export function capsFor(role: Role, cfg: { allowBypass: boolean; localOnly: boolean }): { role: Role; canBypass: boolean } {
  return { role, canBypass: role === 'admin' && cfg.allowBypass === true && cfg.localOnly === true };
}
