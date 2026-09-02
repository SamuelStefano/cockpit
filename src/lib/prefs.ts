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

// Beep no fim do turno. Default DESLIGADO: som que toca sozinho num app que fica
// aberto o dia todo irrita mais do que ajuda — quem quer, liga.
export const NOTIFY_SOUND_KEY = 'notify.sound';
export const NOTIFY_SOUND_DEFAULT = false;

const DESKTOP_QUERY = '(min-width: 1024px)';

// Abaixo de `lg` a descrição come duas linhas por sessão e a lista cai pra ~5 itens
// na tela. Só muda o DEFAULT: quem já escolheu tem o valor salvo no localStorage, e
// usePersisted só cai no fallback quando não existe valor gravado.
export function showSessionDescDefault(): boolean {
  const mq = typeof window === 'undefined' ? undefined : window.matchMedia?.(DESKTOP_QUERY);
  return mq ? mq.matches : SHOW_SESSION_DESC_DEFAULT;
}

// Perguntas ignoradas na fila "Aguardando você": id da sessão → mtime no momento
// em que foi ignorada. Guardar o mtime (e não um `true`) é o que permite soltar a
// sessão de volta pro topo quando chega uma pergunta NOVA.
export const WAITING_DISMISSED_KEY = 'waitingDismissed';
