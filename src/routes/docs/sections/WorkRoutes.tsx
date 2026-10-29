import { SectionTitle, InfoCard, Pill } from '../atoms';

export function WorkRoutes() {
  return (
    <section id="rotas" className="mb-14 scroll-mt-6">
      <SectionTitle icon="grip" kicker="além do chat" title="Rotas de trabalho"
        desc="O menu de rotas (e o ⌘K) leva a telas que não são conversa: agendar, medir custo e faturar." />
      <div className="grid gap-3 sm:grid-cols-2">
        <InfoCard icon="clock" title="Crons">
          Prompts agendados: <Pill>diário</Pill> num horário, <Pill>intervalo</Pill> em minutos ou <Pill>uma vez</Pill> numa
          data (com atalho pro reset da cota). Cada um escolhe modo (planejar/executar) e modelo. A faixa
          “Próximas 24h” marca disparos a menos de 15 min um do outro — eles dividem a mesma janela de cota.
        </InfoCard>
        <InfoCard icon="zap" title="Uso">
          Custo estimado de 90 dias, custo de hoje, média por sessão e a tendência por período. A tabela por sessão
          ordena por custo, saída ou último uso e mostra 50 de cada vez. Com a página aberta, atualiza a cada minuto.
        </InfoCard>
      </div>
    </section>
  );
}
