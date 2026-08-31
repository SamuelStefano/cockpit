import { statSync } from 'node:fs';
import { join } from 'node:path';
import { CONFIG } from '../config';

const ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

// O item da fila guarda o sessionId de quando foi enfileirado. Esse id morre: a
// sessão compacta, o usuário faz handoff, o arquivo é purgado. `claude --resume`
// com id inexistente sai na hora sem produzir nada — o turno morre, o item volta
// pra fila e volta a falhar igual, até bater o teto de tentativas. Era um jeito
// de a fila "travar" sozinha. Sem transcript pra retomar, roda como turno novo:
// pior que continuar a conversa, muito melhor que nunca rodar.
// Transcript de 0 byte cai no mesmo buraco: o arquivo existe (a sessão foi criada e
// o processo morreu antes de escrever) mas não há nada pra retomar, então o `--resume`
// morre igual e o item volta pra fila em loop.
export function resumableId(id: string | undefined, dir = CONFIG.projectsDir): string | undefined {
  if (!id || !ID_RE.test(id)) return undefined;
  try { return statSync(join(dir, `${id}.jsonl`)).size > 0 ? id : undefined; } catch { return undefined; }
}
