import { SectionTitle, Card } from '../atoms';

export function Overview() {
  return (
    <section id="visao" className="mb-14 scroll-mt-6">
      <SectionTitle icon="sparkles" kicker="o básico" title="O que é o Deck"
        desc="Um app web que conecta você a um agente Claude rodando na sua máquina. Pense nele como o deck de comando de uma nave: vários painéis à mão, cada um cuidando de uma parte da operação." />
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-orange-400/80">Conversa</div>
          <p className="text-[13px] leading-relaxed text-neutral-400">Você escreve, o agente responde, edita arquivos e roda comandos — conforme o modo que você escolher.</p>
        </Card>
        <Card>
          <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-violet-400/80">Memória</div>
          <p className="text-[13px] leading-relaxed text-neutral-400">O agente guarda contexto entre conversas em arquivos que você pode ler e pesquisar na aba Contextos.</p>
        </Card>
        <Card>
          <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-sky-400/80">Operação</div>
          <p className="text-[13px] leading-relaxed text-neutral-400">Telemetria da VPS, terminais reais e painel de saúde pra você ver e controlar o que está acontecendo.</p>
        </Card>
      </div>
    </section>
  );
}
