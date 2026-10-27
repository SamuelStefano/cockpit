// A new chat runs as `new-…` until its first turn ends and the key migrates to the real
// session id. That migration is the same conversation; any other change of the active
// session is the user leaving it.
export function leftConversation(prev: string, next: string, migratedTo: string | undefined): boolean {
  if (!prev || prev === next) return false;
  return next !== migratedTo;
}
