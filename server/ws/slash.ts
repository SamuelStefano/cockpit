import { broadcast } from './broadcast';

// Comandos slash ACIONÁVEIS no app (interceptados em Chat.tsx, ver #140): o
// `claude -p` headless não interpreta slash, então estes são tratados client-side.
// Semeia o palette pra "/" nunca vir vazio (o CLI raramente reporta slash_commands
// no init headless). Une-se ao que o CLI eventualmente reporta.
export const SEED_SLASH = [
  'help', 'clear', 'new',
  'model opus', 'model sonnet', 'model haiku',
  'plan', 'auto', 'execute',
  'effort low', 'effort medium', 'effort high', 'effort xhigh', 'effort max',
];

// Lista de slash-commands: seed app-side + aprendida do system/init (global ao
// CLI+skills). Cacheada em memória pra popular o palette de comandos.
let slashCommands: string[] = [...SEED_SLASH];

export function getSlashCommands(): string[] { return slashCommands; }

// Mescla o que o CLI reportou com o seed; rebroadcast só quando muda.
export function applySlashCommands(sc: string[]) {
  const merged = [...SEED_SLASH, ...sc.filter((c) => !SEED_SLASH.includes(c))];
  if (merged.join() !== slashCommands.join()) {
    slashCommands = merged;
    broadcast({ t: 'slash-commands', items: slashCommands });
  }
}
