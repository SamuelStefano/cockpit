import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { putDrop, listDrops, openDrop, removeDrop, sweepDrops, validSlug } from './drop';

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'deck-drop-')); process.env.COCKPIT_DROP_DIR = join(dir, 'drops'); });
afterEach(() => { delete process.env.COCKPIT_DROP_DIR; try { rmSync(dir, { recursive: true, force: true }); } catch { /* ok */ } });

function mode(p: string): string {
  return (statSync(p).mode & 0o777).toString(8);
}

describe('drop privado', () => {
  it('grava com arquivo 0600 dentro de um dir 0700', async () => {
    const r = await putDrop('deploy.env', 'TOKEN=abc');
    expect('error' in r).toBe(false);
    if ('error' in r) return;
    expect(mode(process.env.COCKPIT_DROP_DIR!)).toBe('700');
    expect(mode(r.path)).toBe('600');
  });

  it('conserta o modo de um arquivo que já existia frouxo', async () => {
    const root = process.env.COCKPIT_DROP_DIR!;
    await putDrop('velho', 'x');
    writeFileSync(join(root, 'velho'), 'y', { mode: 0o644 });
    const r = await putDrop('velho', 'novo');
    if ('error' in r) throw new Error(r.error);
    expect(mode(r.path)).toBe('600');
  });

  it('devolve só a referência — nunca o conteúdo', async () => {
    const r = await putDrop('chave', 'sk-super-secreto');
    if ('error' in r) throw new Error(r.error);
    expect(Object.keys(r).sort()).toEqual(['bytes', 'expiresAt', 'mtime', 'path', 'sha256', 'slug']);
    expect(JSON.stringify(r)).not.toContain('sk-super-secreto');
    expect(r.bytes).toBe('sk-super-secreto'.length);
  });

  it('sha256 é o do conteúdo gravado', async () => {
    const conteudo = 'linha 1\nlinha 2 com acento: ção\n';
    const r = await putDrop('script.sh', conteudo);
    if ('error' in r) throw new Error(r.error);
    expect(r.sha256).toBe(createHash('sha256').update(Buffer.from(conteudo, 'utf8')).digest('hex'));
    expect(r.bytes).toBe(Buffer.byteLength(conteudo, 'utf8'));
  });

  it('recusa path traversal, barra, dotfile e nome fora da regex', async () => {
    for (const slug of ['..', '../fora', '../../etc/passwd', 'a/b', '/etc/passwd', '.ttl.json', '.bashrc', '', 'x'.repeat(65), 'com espaço', 'a\0b']) {
      expect(validSlug(slug)).toBe(false);
      expect(await putDrop(slug, 'x')).toEqual({ error: 'nome inválido' });
      expect(await openDrop(slug)).toEqual({ error: 'nome inválido' });
      expect(await removeDrop(slug)).toEqual({ error: 'nome inválido' });
    }
    // nada escapou do dir do drop
    expect(existsSync(join(dir, 'fora'))).toBe(false);
  });

  it('não sobrescreve arquivo fora do dir nem com slug que parece caminho', async () => {
    const alvo = join(dir, 'alvo.txt');
    writeFileSync(alvo, 'original');
    expect(await putDrop('../alvo.txt', 'invadido')).toEqual({ error: 'nome inválido' });
    expect(mode(alvo)).not.toBe('600');
  });

  it('recusa conteúdo vazio e não-string', async () => {
    expect(await putDrop('vazio', '')).toEqual({ error: 'conteúdo vazio' });
    expect(await putDrop('nulo', undefined)).toEqual({ error: 'conteúdo vazio' });
    expect(await putDrop('grande', 'x'.repeat(1_000_001))).toEqual({ error: 'conteúdo grande demais' });
  });

  it('lista referências sem conteúdo, mais novo primeiro', async () => {
    await putDrop('um', 'a');
    await putDrop('dois', 'bb');
    const items = await listDrops();
    expect(items.map((i) => i.slug).sort()).toEqual(['dois', 'um']);
    expect(JSON.stringify(items)).not.toContain('"content"');
    expect(items.find((i) => i.slug === 'dois')?.bytes).toBe(2);
  });

  it('nunca lista o índice de TTL', async () => {
    await putDrop('com-ttl', 'x', 60_000);
    expect((await listDrops()).map((i) => i.slug)).toEqual(['com-ttl']);
  });

  it('open devolve o conteúdo só quando pedido; rm apaga', async () => {
    await putDrop('env', 'A=1');
    const r = await openDrop('env');
    if ('error' in r) throw new Error(r.error);
    expect(r.content).toBe('A=1');
    expect(await removeDrop('env')).toEqual({ ok: true });
    expect(await listDrops()).toEqual([]);
    expect(await openDrop('env')).toEqual({ error: 'drop não encontrado' });
  });

  it('expira por TTL: some da lista, do open e do disco', async () => {
    const r = await putDrop('efemero', 'segredo', 1000);
    if ('error' in r) throw new Error(r.error);
    expect(r.expiresAt).toBeGreaterThan(Date.now());
    const depois = Date.now() + 2000;
    expect(await openDrop('efemero', depois)).toEqual({ error: 'drop expirado' });
    await putDrop('efemero', 'segredo', 1000);
    expect((await listDrops(depois)).map((i) => i.slug)).toEqual([]);
    expect(existsSync(join(process.env.COCKPIT_DROP_DIR!, 'efemero'))).toBe(false);
  });

  it('sweep remove o vencido e preserva o vivo', async () => {
    await putDrop('curto', 'x', 1000);
    await putDrop('longo', 'y', 600_000);
    await putDrop('sem-ttl', 'z');
    expect(await sweepDrops(Date.now() + 5000)).toBe(1);
    expect((await listDrops()).map((i) => i.slug).sort()).toEqual(['longo', 'sem-ttl']);
  });

  it('sem TTL não vence e o put novo limpa o TTL antigo', async () => {
    await putDrop('perene', 'x', 1000);
    const r = await putDrop('perene', 'x');
    if ('error' in r) throw new Error(r.error);
    expect(r.expiresAt).toBeUndefined();
    expect(await sweepDrops(Date.now() + 60_000)).toBe(0);
  });

  it('dir inexistente = lista vazia, sem estourar', async () => {
    process.env.COCKPIT_DROP_DIR = join(dir, 'nunca-criado');
    expect(await listDrops()).toEqual([]);
    expect(await sweepDrops()).toBe(0);
  });

  it('o padrão fica em ~/.deck-drop', async () => {
    delete process.env.COCKPIT_DROP_DIR;
    const r = await putDrop('padrao', 'x');
    if ('error' in r) throw new Error(r.error);
    // HOME é descartável no vitest.setup — não encosta no ~ real de quem roda.
    expect(r.path).toBe(join(homedir(), '.deck-drop', 'padrao'));
  });
});
