import type { PrSummary } from '../../../shared/prs';

export function fixCiPrompt(pr: Pick<PrSummary, 'url' | 'number' | 'headRef'>, failing: string[]): string {
  const checks = failing.length ? `Checks que falharam:\n${failing.map((n) => `- ${n}`).join('\n')}\n\n` : '';
  return [
    `O CI da PR ${pr.url} falhou.`,
    '',
    `${checks}Leia os logs com o \`gh\` (\`gh pr checks ${pr.url}\`, depois \`gh run view <run-id> --repo <owner/repo> --log-failed\`), conserte o problema na branch da PR (${pr.headRef}) e faça push.`,
    'Não espere o CI rodar de novo: faça push e reporte o que mudou.',
  ].join('\n');
}

export function reviewPrompt(pr: Pick<PrSummary, 'url'>): string {
  return [
    `Revise a PR ${pr.url} usando a skill code-review.`,
    '',
    'Reporte os achados aqui no chat. Não comente nem poste nada na PR.',
  ].join('\n');
}
