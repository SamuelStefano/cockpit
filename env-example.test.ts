import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));

// Só o que é config DESTE projeto. PATH/HOME/LANG/TMPDIR/NODE_ENV são do sistema e
// não têm o que documentar aqui.
const PREFIXOS = /^(COCKPIT|DECK|DFL|VITE|SUPABASE|RELAY|ANTHROPIC)_/;

// Código de produção. `scripts/` fica de fora de propósito: as vars de lá (SMOKE_BASE,
// os overrides do triador) são maquinário de teste/ops, não configuração do app.
const DIRS = ['server', 'relay/src', 'src', 'shared'];

function arquivosTs(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...arquivosTs(rel));
    else if (/\.tsx?$/.test(e.name) && !/\.(test|spec)\.tsx?$/.test(e.name)) out.push(rel);
  }
  return out;
}

function varsLidasNoCodigo(): Map<string, string> {
  // nome -> primeiro arquivo onde aparece, pra a falha dizer onde procurar.
  const achadas = new Map<string, string>();
  for (const f of DIRS.flatMap(arquivosTs)) {
    const src = readFileSync(join(ROOT, f), 'utf8');
    const padroes = [
      /process\.env\.([A-Z][A-Z0-9_]*)/g,
      /process\.env\[['"]([A-Z][A-Z0-9_]*)['"]\]/g,
      /import\.meta\.env\.([A-Z][A-Z0-9_]*)/g,
      // relay/src/main.ts lê tudo por um helper; sem isto SUPABASE_URL escaparia
      // do scan — que é exatamente como ela sumiu do .env.example.
      /required\(['"]([A-Z][A-Z0-9_]*)['"]\)/g,
    ];
    for (const p of padroes) {
      for (const m of src.matchAll(p)) {
        if (PREFIXOS.test(m[1]) && !achadas.has(m[1])) achadas.set(m[1], f);
      }
    }
  }
  return achadas;
}

function varsDocumentadas(): Set<string> {
  const txt = readFileSync(join(ROOT, '.env.example'), 'utf8');
  return new Set(
    txt.split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
      .map((l) => l.split('=')[0].trim()),
  );
}

// O .env.example tinha apodrecido nas DUAS direções ao mesmo tempo: SUPABASE_URL era
// obrigatória e não estava listada (o relay saía com 1 na cara de quem copiasse o
// arquivo), e SUPABASE_JWKS_URL estava listada sem ninguém ler (a URL do JWKS é
// derivada de SUPABASE_URL). Documentação que ninguém verifica volta a mentir, então
// as duas direções viram teste.
describe('.env.example acompanha o código', () => {
  it('documenta toda var de config lida em produção', () => {
    const doc = varsDocumentadas();
    const faltando = [...varsLidasNoCodigo()]
      .filter(([nome]) => !doc.has(nome))
      .map(([nome, arquivo]) => `${nome} (lida em ${arquivo})`);
    expect(faltando).toEqual([]);
  });

  it('não lista var que ninguém lê', () => {
    const lidas = varsLidasNoCodigo();
    expect([...varsDocumentadas()].filter((n) => !lidas.has(n))).toEqual([]);
  });

  it('não expõe segredo com prefixo VITE_', () => {
    const suspeitas = [...varsDocumentadas()].filter(
      (n) => n.startsWith('VITE_') && /(SERVICE_ROLE|SECRET|_TOKEN|PRIVATE|PASSWORD)/.test(n),
    );
    expect(suspeitas).toEqual([]);
  });
});
