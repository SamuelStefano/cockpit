import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

// Rascunho de notas livres do usuário (aba Notas). Um doc markdown único e
// persistido — o usuário anota coisas soltas ao longo do tempo e depois manda a IA
// destilar num contexto. Fica fora do workdir do agente (em ~/.cockpit) pra não
// virar contexto que o agente lê sozinho; só entra quando o usuário pede a análise.
// Path lido em runtime (não no load) pra ser testável via COCKPIT_NOTES.
function notesFile(): string {
  return process.env.COCKPIT_NOTES ?? join(homedir(), '.cockpit', 'notes.md');
}
// Teto generoso: rascunho, não despejo. Acima disso trunca (não quebra a escrita).
const MAX_BYTES = 500_000;

export async function getNotes(): Promise<string> {
  try { return await readFile(notesFile(), 'utf8'); } catch { return ''; }
}

export async function saveNotes(text: string): Promise<void> {
  const t = typeof text === 'string' ? text.slice(0, MAX_BYTES) : '';
  const f = notesFile();
  await mkdir(dirname(f), { recursive: true });
  await writeFile(f, t, 'utf8');
}
