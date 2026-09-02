import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { mkdtempSync, rmSync, existsSync, writeFileSync, utimesSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

// COCKPIT_PARKED é lido no import (const PARKED_PATH), então fixamos o caminho ANTES
// de importar o módulo e isolamos os casos apagando esse arquivo entre eles — as ops
// leem/escrevem disco a cada chamada (fonte de verdade cross-process).
const DIR = mkdtempSync(join(tmpdir(), 'parked-'));
const PARKED_FILE = join(DIR, 'parked.json');
const PAUSE_FILE = join(DIR, 'queue-paused.json');
process.env.COCKPIT_PARKED = PARKED_FILE;
process.env.COCKPIT_QUEUE_PAUSE = PAUSE_FILE;

const mod = await import('./parked');
const { addParked, retryParked, removeParked, editParked, moveParked, promoteParked, shiftParked, unshiftParked, findParked, takeParked, parkedHeads, parkedView, clearParked, isQueuePaused, setQueuePaused } = mod;

// addParked devolve { id } | { reject }; nos testes que só querem o id, isto encurta.
const add = (key: string, item: Parameters<typeof addParked>[1]): string => {
  const r = addParked(key, item);
  return 'id' in r ? r.id : '';
};

beforeEach(() => {
  rmSync(PARKED_FILE, { force: true });
  rmSync(PAUSE_FILE, { force: true });
});
afterAll(() => rmSync(DIR, { recursive: true, force: true }));

describe('parked fila (persistência)', () => {
  it('add/parkedView roundtrip com metadados', () => {
    const id = add('sess1', { prompt: 'oi', model: 'opus' });
    expect(id).toBeTruthy();
    const view = parkedView();
    // `model` vai junto: é a semente do seletor do disparo em background.
    expect(view).toEqual([{ sessionKey: 'sess1', id, text: 'oi', at: expect.any(Number), model: 'opus' }]);
  });

  it('editParked troca o texto no lugar (mesma posição, id e `at`)', () => {
    add('s', { prompt: 'a' });
    const id = add('s', { prompt: 'b', model: 'opus' });
    const before = parkedView().find((v) => v.id === id)!;
    editParked('s', id, 'b corrigido', 'student');
    const after = parkedView();
    expect(after.map((v) => v.text)).toEqual(['a', 'b corrigido']);
    expect(after[1].at).toBe(before.at);
    // Os params com que o item foi criado sobrevivem à edição (o drainer usa eles).
    expect(mod.parkedHeads()[0].first.prompt).toBe('a');
    expect(shiftParked('s')?.prompt).toBe('a');
    expect(shiftParked('s')?.model).toBe('opus');
  });

  it('editParked é no-op com chave inválida, id inexistente ou texto vazio', () => {
    const id = add('s', { prompt: 'a' });
    editParked('bad key!', id, 'x', 'admin');
    editParked('s', 'pk-fantasma', 'x', 'admin');
    editParked('s', id, '   ', 'admin');
    expect(parkedView().map((v) => v.text)).toEqual(['a']);
  });

  it('student não reescreve item enfileirado por admin (herdaria o bypass)', () => {
    const id = add('s', { prompt: 'a', role: 'admin', bypass: true });
    editParked('s', id, 'rm -rf', 'student');
    expect(parkedView().map((v) => v.text)).toEqual(['a']);
    editParked('s', id, 'a revisado', 'admin');
    expect(parkedView().map((v) => v.text)).toEqual(['a revisado']);
  });

  it('rejeita sessionKey inválida', () => {
    expect(addParked('bad key!', { prompt: 'x' })).toEqual({ reject: 'sessao-invalida' });
  });

  it('shiftParked drena FIFO e some do disco ao esvaziar', () => {
    add('s', { prompt: 'a' });
    add('s', { prompt: 'b' });
    expect(shiftParked('s')?.prompt).toBe('a');
    expect(shiftParked('s')?.prompt).toBe('b');
    expect(shiftParked('s')).toBeUndefined();
    expect(parkedHeads()).toEqual([]);
  });

  it('moveParked reordena e respeita bordas', () => {
    const a = add('s', { prompt: 'a' });
    add('s', { prompt: 'b' });
    const c = add('s', { prompt: 'c' });
    moveParked('s', c, -1);
    expect(parkedView().map((v) => v.text)).toEqual(['a', 'c', 'b']);
    moveParked('s', a, -1); // topo não sobe
    expect(parkedView().map((v) => v.text)).toEqual(['a', 'c', 'b']);
  });

  it('removeParked tira só o item; clearParked zera a sessão', () => {
    const a = add('s', { prompt: 'a' });
    add('s', { prompt: 'b' });
    removeParked('s', a);
    expect(parkedView().map((v) => v.text)).toEqual(['b']);
    clearParked('s', 'admin');
    expect(parkedView()).toEqual([]);
  });

  // Mesma guarda de take/edit: item de admin (pode carregar bypass) só sai pela mão
  // de admin. Antes remove/clear não olhavam o papel e um student apagava a fila alheia.
  it('student não remove nem limpa item de admin; os dele saem normalmente', () => {
    const adm = add('s', { prompt: 'adm', role: 'admin', bypass: true });
    const stu = add('s', { prompt: 'stu', role: 'student' });
    removeParked('s', adm, 'student');
    expect(parkedView().map((v) => v.text)).toEqual(['adm', 'stu']);
    removeParked('s', stu, 'student');
    expect(parkedView().map((v) => v.text)).toEqual(['adm']);
    add('s', { prompt: 'stu2', role: 'student' });
    clearParked('s', 'student');
    expect(parkedView().map((v) => v.text)).toEqual(['adm']);
    clearParked('s', 'admin');
    expect(parkedView()).toEqual([]);
  });
});

describe('unshiftParked (devolução)', () => {
  it('devolve pro topo preservando id e posição', () => {
    const a = add('s', { prompt: 'a' });
    add('s', { prompt: 'b' });
    const first = shiftParked('s')!;
    expect(unshiftParked('s', first)).toBe(1);
    expect(parkedView().map((v) => v.text)).toEqual(['a', 'b']);
    expect(parkedView()[0].id).toBe(a);
  });

  it('conta as tentativas pra o chamador poder cortar o loop', () => {
    add('s', { prompt: 'a' });
    let item = shiftParked('s')!;
    expect(unshiftParked('s', item)).toBe(1);
    item = shiftParked('s')!;
    expect(unshiftParked('s', item)).toBe(2);
    item = shiftParked('s')!;
    expect(unshiftParked('s', item)).toBe(3);
  });

  it('não duplica item que já está na fila', () => {
    add('s', { prompt: 'a' });
    const item = shiftParked('s')!;
    unshiftParked('s', item);
    expect(unshiftParked('s', item)).toBe(0);
    expect(parkedView()).toHaveLength(1);
  });

  it('no teto de tentativas o item fica SEGURADO (guardado, mas fora do dreno)', () => {
    add('s', { prompt: 'a' });
    let item = shiftParked('s')!;
    unshiftParked('s', item);
    expect(parkedView()[0].held).toBeUndefined();
    item = shiftParked('s')!;
    unshiftParked('s', item);
    item = shiftParked('s')!;
    expect(unshiftParked('s', item)).toBe(3);
    expect(parkedView()[0].held).toBe(true);
    expect(parkedHeads()[0].first.held).toBe(true);
  });

  it('retryParked destrava o item e zera as tentativas', () => {
    const id = add('s', { prompt: 'a' });
    for (let i = 0; i < 3; i++) unshiftParked('s', shiftParked('s')!);
    expect(retryParked('s', id)).toBe(true);
    expect(parkedView()[0].held).toBeUndefined();
    expect(parkedHeads()[0].first.attempts).toBeUndefined();
    expect(retryParked('s', 'pk-fantasma')).toBe(false);
  });

  it('fila cheia não engole a devolução', () => {
    for (let i = 0; i < 50; i++) add('s', { prompt: `p${i}` });
    const item = shiftParked('s')!;
    for (let i = 0; i < 2; i++) add('s', { prompt: `extra${i}` });
    expect(unshiftParked('s', item)).toBe(1);
    expect(parkedView()[0].id).toBe(item.id);
  });
});

describe('lock cross-process', () => {
  const LOCK_FILE = `${PARKED_FILE}.lock`;

  it('não deixa lock pra trás depois da operação', () => {
    add('s', { prompt: 'a' });
    shiftParked('s');
    expect(existsSync(LOCK_FILE)).toBe(false);
  });

  it('lock órfão de processo morto não trava a fila pra sempre', () => {
    writeFileSync(LOCK_FILE, '');
    const velho = Date.now() / 1000 - 60;
    utimesSync(LOCK_FILE, velho, velho);
    expect(addParked('s', { prompt: 'a' })).toHaveProperty('id');
    rmSync(LOCK_FILE, { force: true });
  });

  it('escrita concorrente de dois processos não perde item', async () => {
    const script = join(DIR, 'writer.mts');
    writeFileSync(
      script,
      `process.env.COCKPIT_PARKED = ${JSON.stringify(PARKED_FILE)};\n` +
        `const m = await import(${JSON.stringify(resolve(HERE, 'parked.ts'))});\n` +
        `for (let i = 0; i < 15; i++) m.addParked('s', { prompt: process.argv[2] + i });\n`,
    );
    const child = (tag: string) =>
      new Promise<void>((ok, err) => {
        execFile('npx', ['tsx', script, tag], { cwd: resolve(HERE, '../..') }, (e) => (e ? err(e) : ok()));
      });
    await Promise.all([child('a'), child('b')]);
    expect(parkedView()).toHaveLength(30);
  }, 60_000);
});

describe('disparo avulso (findParked/takeParked)', () => {
  it('findParked espia sem tirar da fila nem contar tentativa', () => {
    const id = add('s', { prompt: 'a', model: 'opus' });
    expect(findParked('s', id)?.prompt).toBe('a');
    expect(findParked('s', id)?.model).toBe('opus');
    expect(parkedView()).toHaveLength(1);
    expect(findParked('s', 'pk-fantasma')).toBeNull();
  });

  it('takeParked tira o item do MEIO da fila, com os params intactos', () => {
    add('s', { prompt: 'a' });
    const id = add('s', { prompt: 'b', model: 'haiku', effort: 'low' });
    add('s', { prompt: 'c' });
    const it = takeParked('s', id, 'admin');
    expect(it?.prompt).toBe('b');
    expect(it?.model).toBe('haiku');
    expect(it?.effort).toBe('low');
    expect(parkedView().map((v) => v.text)).toEqual(['a', 'c']);
  });

  it('takeParked recusa item de admin quando quem pede é student (herdaria bypass)', () => {
    const id = add('s', { prompt: 'a', role: 'admin', bypass: true });
    expect(takeParked('s', id, 'student')).toBeNull();
    expect(parkedView()).toHaveLength(1);
    expect(takeParked('s', id, 'admin')?.prompt).toBe('a');
  });

  it('takeParked no último item apaga a chave da sessão', () => {
    const id = add('s', { prompt: 'só' });
    takeParked('s', id, 'admin');
    expect(parkedView()).toEqual([]);
  });
});

describe('promoteParked (furar a fila)', () => {
  it('joga o item do fim pro topo preservando a ordem dos outros', () => {
    add('s', { prompt: 'a' });
    add('s', { prompt: 'b' });
    const id = add('s', { prompt: 'c', model: 'haiku' });
    expect(promoteParked('s', id)).toBe(true);
    expect(parkedView().map((v) => v.text)).toEqual(['c', 'a', 'b']);
    // Promover é reordenar, não reenfileirar: os params com que o item foi criado ficam.
    expect(findParked('s', id)?.model).toBe('haiku');
  });

  it('item já no topo é no-op bem-sucedido', () => {
    const id = add('s', { prompt: 'a' });
    add('s', { prompt: 'b' });
    expect(promoteParked('s', id)).toBe(true);
    expect(parkedView().map((v) => v.text)).toEqual(['a', 'b']);
  });

  // O chamador mata o turno em andamento com base neste retorno: um false errado
  // custaria o turno do usuário por um item que não existe mais.
  it('retorna false pra id fantasma e pra sessão sem fila', () => {
    add('s', { prompt: 'a' });
    expect(promoteParked('s', 'pk-fantasma')).toBe(false);
    expect(promoteParked('vazia', 'pk-1')).toBe(false);
  });
});

describe('pausa manual da fila', () => {
  it('default = não pausada (sem arquivo)', () => {
    expect(isQueuePaused()).toBe(false);
  });
  it('setQueuePaused(true) persiste e isQueuePaused reflete', () => {
    setQueuePaused(true);
    expect(isQueuePaused()).toBe(true);
    setQueuePaused(false);
    expect(isQueuePaused()).toBe(false);
  });
});
