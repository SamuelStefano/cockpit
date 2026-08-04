import { SectionTitle, InfoCard, Callout, Pill, DocFigure } from '../atoms';
import { PlaygroundScope } from './PlaygroundScope';

export function Playground() {
  return (
    <section id="playground" className="mb-14 scroll-mt-6">
      <SectionTitle icon="code" kicker="bancada" title="Playground & modo App"
        desc="Na aba /play você escreve código e vê o resultado na hora. O modo App — que agora é a aba padrão — vai além do preview: ele monta o seu componente dentro do próprio Deck, com os componentes de verdade do design system." />
      <DocFigure src="/docs-play.jpg" alt="Playground mostrando editor de código à esquerda e preview ao vivo à direita" caption="Editor + live preview: escreva e veja o resultado na mesma tela. Aba React em iframe isolado." />
      <div className="grid gap-3 sm:grid-cols-2">
        <InfoCard icon="zap" title="Runtimes isolados (iframe)">
          As abas <span className="font-medium text-neutral-300">React, HTML, iPhone, SVG e Testes</span> continuam como sempre:
          cada uma roda dentro de um <Pill>iframe sandbox</Pill> com só os scripts liberados, numa origem separada da do app.
        </InfoCard>
        <InfoCard icon="sparkles" iconClass="text-violet-300" title="Modo App (no documento)">
          Este é diferente: não tem iframe. O código é transpilado com <span className="font-medium text-neutral-300">sucrase</span> e avaliado no próprio
          documento do app, e o componente é montado na <span className="font-medium text-neutral-300">mesma árvore React</span> do Deck.
          Por isso ele usa os primitivos reais — não cópias. É pra caçar bug de UI mexendo nos componentes de verdade, em tempo real.
        </InfoCard>
      </div>
      <PlaygroundScope />
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <InfoCard icon="monitor" title="Barra do estúdio">
          Seletor de viewport (<span className="font-medium text-neutral-300">Fluido · Desktop · Tablet · Mobile</span>), lista do escopo,
          voltar ao cenário original, console, copiar e baixar o código.
        </InfoCard>
        <InfoCard icon="shield" iconClass="text-emerald-300" title="Erro não derruba a rota">
          Um <Pill>throw</Pill> no render é contido por uma barreira de erro (<Pill>SandboxBoundary</Pill>) e vira mensagem na tela.
          Cada versão nova do código é uma tentativa nova — é só corrigir e continuar.
        </InfoCard>
        <InfoCard icon="terminal" iconClass="text-sky-300" title="Console grampeado">
          O painel de console grampeia o <Pill>console.*</Pill> global enquanto a rota está montada — devtools sem devtools — e também captura
          erro não tratado e promessa rejeitada. Ao sair da rota, o console original é restaurado.
        </InfoCard>
        <InfoCard icon="clock" iconClass="text-amber-300" title="Timers presos à versão">
          <Pill>setTimeout</Pill>, <Pill>setInterval</Pill> e <Pill>requestAnimationFrame</Pill> do seu código são injetados no escopo e
          cancelados quando você edita: nenhum loop de uma versão antiga fica batendo em segundo plano.
        </InfoCard>
      </div>
      <DocFigure src="/docs-app.jpg" alt="Playground no runtime React mostrando componente contador com preview interativo" caption="Runtime React em iframe: cada edição recompila e atualiza o preview sem recarregar a página." />
      <Callout icon="shield-off" tone="red">
        <span className="font-medium">Modo App não é compartilhável por link ·</span> o permalink <Pill>#c=</Pill> do <Pill>/play</Pill> continua valendo
        para os runtimes de iframe (origem opaca), mas código in-document roda na origem do app, com a sua sessão e a sua conexão com o agente —
        aceitar código vindo de um link seria execução arbitrária para quem manda o link. O <Pill>decodeShare</Pill> trabalha com
        allowlist — só os runtimes de iframe passam, modo novo nasce não compartilhável — e o <Pill>buildShareUrl</Pill> lança.
      </Callout>
    </section>
  );
}
