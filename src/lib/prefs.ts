// Chaves de preferência de UI compartilhadas entre componentes (evita string
// solta duplicada). Persistidas via usePersisted (localStorage, sync entre abas).

export const SHOW_TOOLS_KEY = 'chat.showTools';
export const SHOW_TOOLS_DEFAULT = true;

// Notas de bastidor do agente ("agora vou abrir a PR") juntas numa caixa fechada,
// deixando só a resposta final do turno solta na thread.
export const GROUP_NOTES_KEY = 'chat.groupNotes';
export const GROUP_NOTES_DEFAULT = true;

// Descrição (resumo IA/snippet) sob o título de cada sessão na sidebar: opcional.
export const SHOW_SESSION_DESC_KEY = 'sessions.showDesc';
export const SHOW_SESSION_DESC_DEFAULT = true;
