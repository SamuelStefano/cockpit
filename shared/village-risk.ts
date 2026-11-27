import type { PlannerTask } from './planner';

const UNSAFE_WORDS = [
  'prod(?:uction|ucao)?', 'migration', 'migracao', 'rls', 'banco', 'database', 'sql', 'supabase', 'dinheiro', 'financeiro', 'financ\\w*',
  'money', 'payment', 'pagamento', 'invoice', 'fatura', 'nfse', 'pix', 'stripe', 'woovi', 'reembolso', 'refund', 'deploy', 'docker', 'swarm',
  'dokploy', 'infisical', 'cloudflare', 'dns', 'firewall', '0\\.0\\.0\\.0', 'porta', 'cron', 'relay', 'segredo', 'secret', 'token', 'senha',
  'chave', 'credencial', 'credential', '\\.env', 'ssh', 'sudo', 'root', 'admin', 'permissao', 'revogar', 'rotacionar', 'irreversivel',
  'irreversible', 'delet(?:e|ed|es|ing|ion)', 'drop(?:ped|ping)?', 'truncate', 'apagar', 'excluir', 'remover', '-rf', '--force', '--hard',
  'main', 'postar', 'publicar', 'e-mail', 'email', 'cliente', 'plans', 'chatwoot', '(?:rm|reset|merge|na)\\\\',
];
export const UNSAFE_NET = new RegExp(`(?<![\\p{L}\\p{N}])(?:${UNSAFE_WORDS.join('|')})s?(?![\\p{L}\\p{N}])`, 'u');

export const normalizeText = (s: string): string => s.normalize('NFKC').toLowerCase().normalize('NFD').replace(/\p{M}+/gu, '');

export function matchesUnsafeNet(task: Pick<PlannerTask, 'title' | 'description'> & Partial<Pick<PlannerTask, 'links' | 'tag' | 'ref'>>): boolean {
  const links = (task.links ?? []).map((l) => `${l.url} ${l.label}`).join('\n');
  return UNSAFE_NET.test(normalizeText(`${task.title}\n${task.description}\n${links}\n${task.tag ?? ''}\n${task.ref ?? ''}`));
}

export function isUnsafeTask(task: Pick<PlannerTask, 'title' | 'description'> & Partial<Pick<PlannerTask, 'links' | 'tag' | 'ref' | 'unsafe'>>): boolean {
  return task.unsafe === true || matchesUnsafeNet(task);
}
