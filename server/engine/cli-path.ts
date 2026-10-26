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
  const home = homedir();
  const local = join(home, '.local', 'bin');
  // Installs by scripts/agent-setup.sh and the official installer land outside the
  // systemd unit's PATH when the unit was written before claude moved.
  const extra = [join(home, '.deck-npm', 'bin'), join(home, '.claude', 'local')]
    .filter((d) => existsSync(join(d, 'claude')) && !base.split(':').includes(d));
  const front = existsSync(join(local, 'claude')) ? [local, ...extra] : extra;
  return front.length ? `${front.join(':')}:${base}` : base;
}
