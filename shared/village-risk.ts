import type { PlannerTask } from './planner';

const TERMS = [
  'prod', 'producao', 'migration', 'migracao', 'rls', 'banco', 'database', 'sql', 'supabase',
  'dinheiro', 'pagamento', 'invoice', 'fatura', 'nfse', 'pix', 'stripe', 'woovi', 'reembolso',
  'deploy', 'docker', 'swarm', 'dokploy', 'infisical', 'cloudflare', 'dns', 'firewall', '0.0.0.0', 'porta', 'cron', 'relay',
  'segredo', 'secret', 'token', 'senha', 'chave', 'credencial', '.env', 'ssh', 'sudo', 'root', 'admin', 'permissao', 'revogar', 'rotacionar',
  'irreversivel', 'delete', 'drop', 'truncate', 'apagar', 'excluir', 'remover', 'rm -rf', '--force', 'reset --hard', 'merge na main',
  'postar', 'publicar', 'e-mail', 'email', 'cliente', 'plans', 'chatwoot',
];

export function normalizeRiskText(s: string): string {
  return s.normalize('NFKC').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const escape = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
const RISK_RE = new RegExp(`(?<![a-z0-9])(?:${TERMS.map(escape).join('|')})s?(?![a-z0-9])`);

export function matchRiskTerm(text: string): string | null {
  return RISK_RE.exec(normalizeRiskText(text))?.[0] ?? null;
}

export function isUnsafeTask(t: Pick<PlannerTask, 'title' | 'description' | 'links' | 'unsafe'>): boolean {
  if (t.unsafe) return true;
  const text = [t.title, t.description, ...t.links.flatMap((l) => [l.url, l.label ?? ''])].join('\n');
  return matchRiskTerm(text) !== null;
}
