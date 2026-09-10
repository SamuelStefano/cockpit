import { SectionTitle, InfoCard, Callout, Pill } from '../atoms';

export function Funnel() {
  return (
    <section id="afunilar" className="mb-14 scroll-mt-6">
      <SectionTitle icon="sparkles" kicker="faxina" title="Afunilar sessões paradas"
        desc="A lista de sessões cresce sozinha e vira ruído. O botão Afunilar manda um agente ler as sessões que ninguém reabre, destilar tudo num contexto só e então arquivá-las — o que importava fica, a rolagem some." />
      <div className="grid gap-3 sm:grid-cols-2">
        <InfoCard icon="sparkles" iconClass="text-orange-300" title="Onde fica">
          Abaixo de <span className="font-medium text-neutral-300">Nova sessão</span>, no painel de sessões — e só aparece quando há
          pelo menos 3 candidatas. O rótulo já diz quantas: "Afunilar 12 paradas".
        </InfoCard>
        <InfoCard icon="clock" iconClass="text-sky-300" title="Quem é candidata">
          Sessão sem toque há mais de <span className="font-medium text-neutral-300">N dias</span> (3, 7, 14 ou 30 — o padrão é 7, e a escolha fica salva).
          Ficam de fora: favoritas, a sessão aberta, as que estão rodando e as que esperam resposta sua. Teto de 20 por rodada.
        </InfoCard>
        <InfoCard icon="file" iconClass="text-violet-300" title="O que o agente grava">
          Um dossiê único em <span className="font-medium text-neutral-300">Contextos</span> (<Pill>funil-AAAAMMDD</Pill>): uma seção por sessão com
          decisões, arquivos, branches, PRs e comandos reais, e uma lista final de <span className="font-medium text-neutral-300">Pendências</span> com a origem de cada uma.
          Sessão sem nada durável entra como "nada a preservar".
        </InfoCard>
        <InfoCard icon="shield" iconClass="text-emerald-300" title="Ordem segura">
          Arquivar é o último passo. Se a destilação falhar, nada é arquivado — você continua com as sessões inteiras.
          E arquivar é reversível: elas seguem em "Arquivadas" e o histórico no disco nunca é apagado.
        </InfoCard>
      </div>
      <Callout icon="zap" tone="amber">
        O modal mostra o prompt exato que vai rodar (em "Ver o prompt que o agente vai rodar") antes de você confirmar — nada é destilado às escondidas.
        É <span className="font-medium">uma</span> chamada por rodada, com o orçamento de transcrição dividido entre as sessões escolhidas, então o custo não cresce com o tamanho da bagunça.
        Dois afunilamentos no mesmo dia geram <Pill>funil-AAAAMMDD-2</Pill> em vez de sobrescrever o primeiro.
      </Callout>
    </section>
  );
}
