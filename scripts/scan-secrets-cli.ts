import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { scanText, scanClientEnvNames, type Finding } from './scan-secrets';

// Entrada de linha de comando da varredura. O módulo com as regras fica separado e
// puro pra ser testável sem tocar em disco.

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', '.claude']);
const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.mts', '.json', '.yml', '.yaml', '.env', '.example', '.sh', '.py', '.sql', '.service', '.md']);

function walk(dir: string, exts: Set<string> | null, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(p, exts, out);
      continue;
    }
    if (!exts || exts.has(extname(name))) out.push(p);
  }
  return out;
}

const findings: Finding[] = [];

// 1. O bundle publicado: é literalmente o que o navegador baixa. Qualquer segredo
//    aqui já é público, independente de o repositório ser privado.
for (const f of walk('dist', null)) {
  findings.push(...scanText(f, readFileSync(f, 'utf8')));
}

// 2. A fonte: pega o segredo antes de ele virar bundle, e pega nome de variável
//    exposta ao cliente que não deveria existir.
// Every tracked source dir plus the root files: a secret pasted into a script,
// a migration, a deploy unit or .env.example is as leaked as one in src/.
const SOURCE_DIRS = ['src', 'server', 'relay', 'monitor', 'shared', 'scripts', 'migrations', 'docs', 'design-kit', '.github'];
const rootFiles = readdirSync('.').filter((n) => statSync(n).isFile() && SOURCE_EXT.has(extname(n)) && n !== 'package-lock.json');
// The scanner's own tests carry fake keys on purpose, to prove the rules fire.
const SELF_FIXTURES = new Set([join('scripts', 'scan-secrets.test.ts')]);
for (const f of SOURCE_DIRS.flatMap((d) => walk(d, SOURCE_EXT)).concat(rootFiles).filter((f) => !SELF_FIXTURES.has(f))) {
  const text = readFileSync(f, 'utf8');
  findings.push(...scanText(f, text));
  if (f.startsWith('src/')) findings.push(...scanClientEnvNames(f, text));
}

if (findings.length === 0) {
  console.log('[scan-secrets] nenhum achado');
  process.exit(0);
}

console.error(`[scan-secrets] ${findings.length} achado(s):\n`);
for (const f of findings) console.error(`  ${f.file}\n    ${f.rule}: ${f.excerpt}`);
console.error('\nSegredo exposto NÃO se resolve apagando a linha: rotacione a credencial primeiro.');
process.exit(1);
