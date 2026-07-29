import type { PrLink } from '../../data/mock';

export interface PrGroupView { repo: string | null; items: PrLink[] }

const LABEL_RE = /^PR\s+(#\d+)(?:\s*·\s*(.+))?$/;

// Prepara um run de PRs pra caber num divisor só: com todas do mesmo repo, ele
// sai do rótulo de cada uma e vira cabeçalho, deixando só os números clicáveis.
// Repos misturados mantêm o rótulo inteiro — senão "#12" viraria ambíguo.
export function prGroupView(prs: PrLink[]): PrGroupView {
  const parsed = prs.map((p) => {
    const m = LABEL_RE.exec(p.label.trim());
    return { num: m?.[1] ?? null, repo: m?.[2]?.trim() ?? null, ...p };
  });
  const repos = new Set(parsed.map((p) => p.repo));
  const short = repos.size === 1 && parsed.every((p) => p.num);
  return {
    repo: repos.size === 1 ? parsed[0].repo : null,
    items: parsed.map((p) => ({ label: short ? p.num! : p.label, url: p.url })),
  };
}
