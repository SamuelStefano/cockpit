import { Pill, SectionTitle, InfoCard } from '../atoms';

export function Context() {
  return (
    <section id="contexto" className="mb-14 scroll-mt-6">
      <SectionTitle icon="zap" kicker="memória de trabalho" title="Contexto & tokens"
        desc="Tudo que o agente 'enxerga' num turno — a conversa, os arquivos lidos, as saídas de comando — vive numa janela de contexto com tamanho fixo (~200k tokens). Esta seção explica o medidor, o que significa contexto cheio e como ler os números de gasto." />
      <div className="grid gap-3 sm:grid-cols-2">
        <InfoCard icon="circle" iconClass="text-amber-300" title="O que é “contexto cheio”">
          Cada mensagem, ferramenta e arquivo lido ocupa espaço na janela. O medidor (%) na sessão mostra quanto já foi usado.
          Perto do limite, o badge <Pill>contexto N%</Pill> avisa: o agente vai <span className="font-medium text-neutral-300">compactar</span> — resumir
          o histórico antigo pra abrir espaço — e pode perder detalhes finos do começo da conversa. Cheio não é erro: é o momento de
          compactar ou abrir uma <span className="font-medium text-neutral-300">nova sessão</span> pra um recomeço limpo.
        </InfoCard>
        <InfoCard icon="sparkles" iconClass="text-violet-300" title="Compactação">
          Automática (perto do limite) ou manual (<Pill>/compact</Pill>). O divisor “Conversa compactada” marca o ponto na timeline;
          nada se perde de verdade — o histórico completo continua no disco e aparece em <span className="font-medium text-neutral-300">“carregar antigas / ver tudo”</span>.
        </InfoCard>
        <InfoCard icon="zap" iconClass="text-orange-300" title="Tokens por turno (a régua certa)">
          O número embaixo de cada resposta = <span className="font-medium text-neutral-300">trabalho novo</span> do turno: entrada + escrita de cache + saída,
          somando todas as chamadas internas. <span className="font-medium text-neutral-300">Releitura de cache fica de fora</span> — cada chamada relê o prefixo
          inteiro da conversa (barato e quase instantâneo), e somar isso inflava um turno comum pra “30M tokens”, um número que não representa gasto real.
        </InfoCard>
        <InfoCard icon="clock" iconClass="text-sky-300" title="Quota do plano">
          O plano funciona por janelas de 5 horas: a barra de <span className="font-medium text-neutral-300">Uso</span> mostra quanto da janela foi consumido
          e quando reseta. Modelo é o maior fator de consumo — Opus gasta mais rápido que Sonnet/Haiku. Acabou a janela? O Deck pausa e
          continua sozinho no reset.
        </InfoCard>
      </div>
    </section>
  );
}
