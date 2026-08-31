import { SectionTitle, InfoCard } from '../atoms';

export function Models() {
  return (
    <section id="modelos" className="mb-14 scroll-mt-6">
      <SectionTitle icon="claude" kicker="o agente" title="Versão e pensamento"
        desc="Cada sessão escolhe qual versão do agente usar e o quanto ela pensa. As versões são puxadas direto da Anthropic, então a lista fica sempre atualizada." />
      <div className="grid gap-3 sm:grid-cols-2">
        <InfoCard icon="claude" title="Versão do agente">
          O seletor <span className="font-medium text-neutral-300">versão</span> lista os modelos disponíveis
          (Opus, Sonnet, Haiku) na release mais recente. Opus é o mais capaz; Haiku, o mais rápido e barato.
          A lista vem do catálogo oficial da Anthropic — quando sai uma versão nova, ela aparece sozinha.
        </InfoCard>
        <InfoCard icon="zap" title="Nível de pensamento">
          O seletor <span className="font-medium text-neutral-300">pensar</span> controla quanto o agente
          raciocina antes de responder (Baixo → Máximo), igual aos chats do Claude. Quanto mais alto, mais
          tokens e custo. O padrão é <span className="font-medium text-neutral-300">Baixo</span>: pedidos
          simples não gastam pensamento à toa. Suba pra Alto/Máximo só nas tarefas difíceis.
        </InfoCard>
      </div>
    </section>
  );
}
