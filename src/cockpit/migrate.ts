// Migração de key da sessão local (`new-xxx`) pro UUID real que o `claude` emite no
// fim do 1º turno. Frames tardios do turno antigo ainda chegam keyed pelo `new-xxx`;
// resolveKey os redireciona pra key migrada (senão recriam thread/linha fantasma).
// Centralizado porque cada handler novo de stream precisa fazer isso — esquecer era
// a classe de bug recorrente (#277/#278/#280).
export function resolveKey(migratedTo: Record<string, string>, key: string): string {
  return migratedTo[key] ?? key;
}

// Renomeia oldKey->newKey num mapa por-sessão preservando a referência quando oldKey
// não existe (evita re-render à toa). O valor local em voo vence qualquer entrada já
// presente em newKey (dados em voo > snapshot do servidor).
export function moveKey<T>(record: Record<string, T>, oldKey: string, newKey: string): Record<string, T> {
  if (!(oldKey in record)) return record;
  const next = { ...record };
  next[newKey] = next[oldKey];
  delete next[oldKey];
  return next;
}
