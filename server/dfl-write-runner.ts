import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { RESULT_MARK } from './dfl-write';

const pexec = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));

// Dispara uma ESCRITA no DFL como PROCESSO FILHO (dfl-write.ts) — o token NUNCA
// entra no processo do WS. O comando vai como JSON no argv; o resultado volta numa
// linha marcada no stdout do filho. Espelha runDflSync (leitura). Ver dfl-write.ts.
export type DflWriteCmd =
  | { kind: 'points-change'; taskId: string; taskName: string; currentPoints: number; newPoints: number; reason?: string }
  | { kind: 'invoice-create'; deliveryId: string; deliveryName: string; projectId?: string | null; projectName?: string | null; referenceMonth: string; pricePerPoint: number; tasks: { id: string; title: string; points: number }[] };

export async function runDflWrite(cmd: DflWriteCmd): Promise<{ ok: true; result: Record<string, unknown> } | { ok: false; error: string }> {
  try {
    const tsx = join(here, '..', 'node_modules', '.bin', 'tsx');
    const script = join(here, 'dfl-write.ts');
    const { stdout } = await pexec(tsx, [script, JSON.stringify(cmd)], { timeout: 60_000 });
    const line = stdout.split('\n').find((l) => l.startsWith(RESULT_MARK));
    if (!line) return { ok: false, error: 'processo de escrita não retornou resultado' };
    return { ok: true, result: JSON.parse(line.slice(RESULT_MARK.length)) };
  } catch (e) {
    const err = e as { stderr?: string; message?: string };
    const msg = err.stderr?.trim() || err.message || String(e);
    return { ok: false, error: msg };
  }
}
