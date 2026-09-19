import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseBuild, buildManifest, resetBuildCache } from './build-id';

const HTML = `<!DOCTYPE html><html><head>
<link rel="icon" href="/favicon.svg" />
<script type="module" crossorigin src="/assets/index-BgpVmUG6.js"></script>
<link rel="modulepreload" crossorigin href="/assets/vendor-XoZ1.js">
<link rel="stylesheet" crossorigin href="/assets/index-BajqxeOE.css">
</head><body><div id="root"></div></body></html>`;

describe('parseBuild', () => {
  it('reads the Vite entry, which already carries the content hash', () => {
    expect(parseBuild(HTML, 1).entry).toBe('/assets/index-BgpVmUG6.js');
  });

  // modulepreload e stylesheet também apontam pra /assets/: pegar o primeiro
  // /assets/*.js do arquivo daria o vendor chunk em algum build, e o entry do
  // cliente nunca casaria — a UI pediria "atualizar" pra sempre.
  it('ignores modulepreload and css, not just the first /assets/ hit', () => {
    const shuffled = HTML.replace('<script type="module"', '<link rel="modulepreload" href="/assets/aaa.js"><script type="module"');
    expect(parseBuild(shuffled, 1).entry).toBe('/assets/index-BgpVmUG6.js');
  });

  it('reports a null entry instead of throwing on an index.html with no bundle', () => {
    expect(parseBuild('<html><body>dev</body></html>', 1).entry).toBeNull();
  });

  // Dois builds podem manter o mesmo entry (só o html mudou); o sha separa os dois.
  it('changes the sha when only the html around the entry changed', () => {
    const a = parseBuild(HTML, 1);
    const b = parseBuild(HTML.replace('<body>', '<body data-v="2">'), 1);
    expect(a.sha256).not.toBe(b.sha256);
  });

  it('is stable for the same html', () => {
    expect(parseBuild(HTML, 1).sha256).toBe(parseBuild(HTML, 9).sha256);
  });
});

describe('buildManifest', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'deck-build-')); resetBuildCache(); });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('returns null when there is no build to serve', () => {
    expect(buildManifest(dir)).toBeNull();
  });

  it('reads the manifest off disk', () => {
    writeFileSync(join(dir, 'index.html'), HTML);
    expect(buildManifest(dir)?.entry).toBe('/assets/index-BgpVmUG6.js');
  });

  // O deploy reescreve o index.html; o cache por mtime não pode servir o entry velho,
  // senão a PWA nunca descobre que há versão nova — que é a razão do endpoint existir.
  it('picks up a redeploy that rewrote index.html', () => {
    const file = join(dir, 'index.html');
    writeFileSync(file, HTML);
    expect(buildManifest(dir)?.entry).toBe('/assets/index-BgpVmUG6.js');
    writeFileSync(file, HTML.replace('BgpVmUG6', 'ZZnew999'));
    utimesSync(file, new Date(), new Date(Date.now() + 5000));
    expect(buildManifest(dir)?.entry).toBe('/assets/index-ZZnew999.js');
  });
});
