// Chaves de preferência de UI compartilhadas entre componentes (evita string
// solta duplicada). Persistidas via usePersisted (localStorage, sync entre abas).

export const SHOW_TOOLS_KEY = 'chat.showTools';
export const SHOW_TOOLS_DEFAULT = true;

// Descrição (resumo IA/snippet) sob o título de cada sessão na sidebar: opcional.
export const SHOW_SESSION_DESC_KEY = 'sessions.showDesc';
export const SHOW_SESSION_DESC_DEFAULT = true;
