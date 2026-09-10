// Prompt do afunilamento de sessões paradas. Mora em shared/ porque a UI MOSTRA
// exatamente o que vai rodar (o botão é "um prompt pronto") e o servidor EXECUTA:
// duas cópias divergiriam na primeira edição.
export const FUNNEL_INSTR = [
  'Você recebe trechos de VÁRIAS sessões de trabalho paradas que serão arquivadas agora.',
  'Escreva, em português, UM dossiê único com o que precisa sobreviver ao arquivamento.',
  'Regras:',
  '- Uma seção `## <título da sessão>` por sessão, na ordem em que aparecem.',
  '- Em cada seção, de 2 a 5 bullets: decisões tomadas, caminhos de arquivo, branches, PRs, comandos e pendências REAIS que apareceram.',
  '- Sessão sem nada durável: escreva só `- nada a preservar` e siga.',
  '- Feche com `## Pendências`, juntando numa lista tudo que ficou em aberto, com a sessão de origem entre parênteses.',
  'Não invente nada que não esteja nos trechos. Responda só o markdown, sem preâmbulo.',
].join('\n');

// Resumo humano do mesmo contrato, pro modal explicar sem despejar o prompt inteiro.
export const FUNNEL_SUMMARY =
  'Um agente lê as sessões escolhidas, destila num único contexto (decisões, arquivos, pendências) e só então arquiva as sessões.';
