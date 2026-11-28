interface RestoreInput {
  chatId: string;
  saved: string;
  sessions: { id: string }[];
  archived: { id: string }[];
  loading: boolean;
}

export function pickRestoredSession({ chatId, saved, sessions, archived, loading }: RestoreInput): string | null {
  const has = (id: string) => !!id && (sessions.some((s) => s.id === id) || archived.some((s) => s.id === id));
  if (has(chatId)) return chatId;
  if (chatId && loading) return null;
  if (has(saved)) return saved;
  return sessions[0]?.id ?? null;
}
