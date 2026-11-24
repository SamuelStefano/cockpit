import { createContext } from 'react';

// True inside a Equipe bot's thread: its AskUserQuestion renders as the lettered
// decision card. Everywhere else the regular card stays as it was.
export const BotThreadContext = createContext(false);

export const BOT_ANSWER_PLACEHOLDER = 'Responda ou fale de outra coisa';
