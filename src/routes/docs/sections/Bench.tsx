import { SectionTitle, InfoCard, StepCard, Callout, Pill } from '../atoms';

export function Bench() {
  return (
    <section id="bench" className="mb-14 scroll-mt-6">
      <SectionTitle icon="grip" kicker="repo de verdade" title="Bench — testar PR dentro do chat"
        desc="O playground monta componentes do próprio Deck. O bench monta os de OUTRO repositório: o servidor compila o componente real da PR num bundle autocontido e o chat renderiza ali mesmo, interativo. É clicar, responder e ver o comportamento de verdade sem sair da conversa." />
      <div className="grid gap-3 sm:grid-cols-3">
        <StepCard step={1} title="Registrar o repo">
          Cada alvo vive em <Pill>~/.cockpit/bench.json</Pill> com raiz, alias, css e content. O bloco cita um
          <span className="font-medium text-neutral-300"> apelido</span>, nunca um caminho. Apontar a raiz pra um
          worktree deixa o bench numa branch própria; aí <Pill>deps</Pill> aponta o <Pill>node_modules</Pill> do
          checkout principal.
        </StepCard>
        <StepCard step={2} title="Abrir o bloco">
          No chat, uma cerca <Pill>```bench:itera-player</Pill> com um componente que faz
          <Pill>export default</Pill>. Os imports do repo alvo (<Pill>@/…</Pill>) funcionam normalmente.
        </StepCard>
        <StepCard step={3} title="Mexer">
          O card espera um clique em <Pill>compilar</Pill> — a cerca fica no histórico, e compilar sozinho gastaria um
          build a cada abertura da conversa. Dali em diante editar recompila, com viewport, console, copiar e baixar.
        </StepCard>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <InfoCard icon="zap" title="CSS é o do repo, não o do Deck">
          Junto do bundle vem o Tailwind compilado do próprio alvo (com o tema dele). Por isso o componente aparece
          com a aparência de produção, e não herda nem vaza estilo do Deck.
        </InfoCard>
        <InfoCard icon="shield" iconClass="text-emerald-300" title="Origem opaca, sempre">
          O bundle roda num <Pill>iframe sandbox</Pill> sem acesso à origem do app — logo sem o seu token nem a sua
          sessão. Origem opaca não tem storage, então o documento instala um <Pill>localStorage</Pill> em memória:
          o app alvo sobe, e nada do bench sobrevive ao reload.
        </InfoCard>
        <InfoCard icon="terminal" iconClass="text-sky-300" title="Compilação confinada, e sem rede">
          O bundler recusa qualquer arquivo fora da raiz registrada e do <Pill>deps</Pill> declarado — sem isso, um
          import apontando pra um arquivo de credencial seria embutido no bundle. E o documento roda com <Pill>connect-src 'none'</Pill>: código de uma
          branch que não é sua não consegue mandar pra fora o que foi inlinado no build.
        </InfoCard>
        <InfoCard icon="clock" iconClass="text-amber-300" title="Build é caro, então tem folga">
          Cada tecla não dispara build: há um respiro de ~0,8s antes de recompilar, e um build que ficou pra trás é
          descartado quando chega o próximo. O tempo de cada compilação aparece no cabeçalho do card.
        </InfoCard>
      </div>
      <Callout icon="shield" tone="amber">
        <span className="font-medium">Só admin ·</span> compilar um repositório da máquina é operação de host. O tipo
        <Pill>bench-build</Pill> fica fora da allowlist de convidado, então a checagem não é um <span className="italic">if</span> que
        alguém pode esquecer — é o padrão de negar por omissão do próprio autorizador.
      </Callout>
    </section>
  );
}
