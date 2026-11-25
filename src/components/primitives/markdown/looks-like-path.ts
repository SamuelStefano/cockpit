export interface PathRef { path: string; line?: number }

// Extensions that make a bare `name.ext` (no directory) a file rather than a
// member access: `console.log`, `user.name` and `Math.max` are far more common
// in a chat than files with those endings.
const BARE_EXT = new Set(['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'json', 'md', 'mdx', 'css', 'scss', 'html', 'yml', 'yaml', 'toml', 'py', 'rs', 'go', 'java', 'rb', 'php', 'cpp', 'hpp', 'cs', 'sql', 'sh', 'txt', 'csv', 'svg', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'xml', 'vue', 'svelte', 'lock']);
const NAMED = /^(Dockerfile|Makefile|LICENSE|Procfile|Gemfile|Rakefile|Justfile|CODEOWNERS|\.(gitignore|gitattributes|dockerignore|npmignore|editorconfig|nvmrc|babelrc|prettierrc|prettierignore|eslintrc|eslintignore))$/;
// Library names and response helpers written like files.
const NOT_FILES = /^((node|next|vue|react|nuxt|nest|express|three|d3|chart|socket|alpine|ember|backbone|discord|p5|angular|moment|vite)\.js|(res|req|response|request|r)\.(json|text|html))$/i;
const LINE_SUFFIX = /(?::(\d+)(?:[:-]\d+)?|#L(\d+)(?:-L?\d+)?)$/;

// A string worth offering as a clickable file, with the `:line` the CLI appends
// (`src/a.ts:42`, `a.ts:42:7`, `a.ts#L42`). The server is the real gate.
export function parsePathRef(raw: string): PathRef | null {
  if (!raw || raw.length > 300 || /\s/.test(raw) || /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) return null;
  const m = LINE_SUFFIX.exec(raw);
  const s = m ? raw.slice(0, m.index) : raw;
  const line = m ? Number(m[1] ?? m[2]) : undefined;
  if (!s || /[<>|*?"'`$;&:#,={}]/.test(s)) return null;
  const segs = s.split('/');
  const base = segs.pop() ?? '';
  if (segs.some((seg) => seg === '..' || !/^[\w@.+~()[\]-]*$/.test(seg))) return null;
  if (!/^[\w@.+~-]+$/.test(base)) return null;
  const ext = /\.([A-Za-z0-9]{1,10})$/.exec(base)?.[1] ?? '';
  const named = NAMED.test(base);
  const ok = segs.length > 0
    ? named || (/[A-Za-z]/.test(ext) && !/^\.+$/.test(base))
    : named || (/^[A-Za-z_][\w.-]*$/.test(base) && BARE_EXT.has(ext.toLowerCase()) && !NOT_FILES.test(base));
  return ok ? { path: s, ...(line ? { line } : {}) } : null;
}

export const looksLikePath = (s: string): boolean => parsePathRef(s) !== null;

// Read/Edit/Write cards carry exactly the file path: taken as is (spaces, no
// extension), as long as it is one line.
export function toolPath(command: string): string | null {
  const p = command.trim();
  return p && p.length <= 1024 && !/[\n\r\0]/.test(p) && !p.split('/').includes('..') ? p : null;
}
