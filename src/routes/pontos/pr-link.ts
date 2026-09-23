// "LS#577" → the PR on GitHub. Refs are written by hand in the marathon file, so
// the prefix is a nickname, not always the repo name. Unknown prefix or free text
// ("~25 PRs") → null and the chip stays plain.
const REPOS: Record<string, string> = {
  ls: 'devfellowship/dfl-lesson-studio',
  'lesson-studio': 'devfellowship/dfl-lesson-studio',
  campaigns: 'devfellowship/dfl-campaigns',
  schema: 'devfellowship/dfl-schema',
  'dfl-schema': 'devfellowship/dfl-schema',
  plans: 'devfellowship/dfl-plans',
  reviews: 'devfellowship/dfl-reviews',
  mcp: 'devfellowship/dfl-mcp-server',
  'components-cli': 'devfellowship/dfl-components-cli',
  skills: 'devfellowship/skills',
  learn: 'devfellowship/dfl-learn',
  website: 'devfellowship/dfl-website',
  services: 'devfellowship/dfl-services',
  thumbify: 'devfellowship/dfl-thumbify',
  payments: 'devfellowship/dfl-payments',
  'itera-player': 'iterahq/itera-player',
  'educar-plus': 'SamuelStefano/educar-plus',
};

// First number wins for ranges ("services#222–#224" → #222).
export function prUrl(ref: string): string | null {
  const m = /^([\w.-]+)#(\d+)/.exec(ref.trim());
  if (!m) return null;
  const repo = REPOS[m[1].toLowerCase()];
  return repo ? `https://github.com/${repo}/pull/${m[2]}` : null;
}
