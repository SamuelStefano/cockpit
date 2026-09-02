import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// `claude update` só mexe no install nativo (~/.local/bin/claude); o npm global em
// /usr/bin/claude fica congelado na versão do dia da instalação. Os supervisores do
// Deck rodam por semanas com o PATH herdado do `npm exec` daquele boot — sem
// ~/.local/bin —, então todo spawn('claude') pegava o CLI velho e a API recusava
// modelo novo ("does not support this model"). Prefixar aqui vale pra qualquer
// spawn sem depender do PATH de quem subiu o processo.
export function cliPath(): string {
  const base = process.env.PATH ?? '';
  const local = join(homedir(), '.local', 'bin');
  return existsSync(join(local, 'claude')) ? `${local}:${base}` : base;
}
