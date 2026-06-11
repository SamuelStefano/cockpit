import { Icon } from '../../../components/primitives';
import { SectionTitle, Card, InfoCard } from '../atoms';

const TRIAGE = [
  { box: 'border-emerald-500/25 bg-emerald-500/[0.06]', chip: 'bg-emerald-500/20 text-emerald-300', label: 'responder', body: 'Pergunta trivial e independente — é respondida na hora num balão lateral, sem atrapalhar o turno principal.' },
  { box: 'border-sky-500/25 bg-sky-500/[0.06]', chip: 'bg-sky-500/20 text-sky-300', label: 'enfileirar', body: 'Complementa o trabalho atual — fica na fila e é enviada sozinha assim que o turno termina.' },
  { box: 'border-amber-500/25 bg-amber-500/[0.06]', chip: 'bg-amber-500/20 text-amber-300', label: 'prioridade', body: 'Urgente ou corrige o rumo — interrompe o turno em andamento e entra na frente.' },
  { box: 'border-violet-500/25 bg-violet-500/[0.06]', chip: 'bg-violet-500/20 text-violet-300', label: 'mesclar', body: 'É continuação do mesmo assunto — tratada como parte do turno atual.' },
] as const;

export function Queue() {
  return (
    <section id="sessoes" className="mb-14 scroll-mt-6">
      <SectionTitle icon="message" kicker="organização" title="Sessões & fila de prompts"
        desc="Cada conversa é uma sessão que você pode favoritar, renomear ou arquivar. E quando você manda uma mensagem enquanto o agente ainda trabalha, um segundo agente decide o que fazer com ela — você não precisa esperar." />
      <div className="grid gap-3 sm:grid-cols-2">
        <InfoCard icon="star" iconClass="text-amber-300" title="Ações da sessão">
          Passe o mouse sobre uma sessão na lista pra ver os botões: <span className="font-medium text-neutral-300">favoritar</span> (fixa no topo),
          <span className="font-medium text-neutral-300"> renomear</span>, <span className="font-medium text-neutral-300">arquivar</span> e <span className="font-medium text-neutral-300">excluir</span>.
          O arquivado some da lista mas continua no disco; o excluído é escondido do Deck — o histórico real em arquivo nunca é apagado de fato.
          Arquivar e excluir pedem confirmação num modal seguro: Enter digitado num campo não confirma, e se a sessão sumir por outro dispositivo o modal fecha sozinho.
        </InfoCard>
        <InfoCard icon="sparkles" iconClass="text-violet-300" title="Resumo & contexto">
          Cada sessão mostra um título destilado pelo agente e um medidor de quanto da janela de contexto já foi usado.
          Quando o contexto enche, o botão de <span className="font-medium text-neutral-300">nova sessão</span> dá um recomeço limpo sem perder o histórico antigo.
        </InfoCard>
      </div>
      <div className="mt-3">
        <Card className="border-orange-500/20">
          <div className="mb-3 flex items-center gap-2">
            <Icon name="claude" size={15} className="text-orange-300" />
            <h3 className="text-[14px] font-semibold text-neutral-100">Triagem do próximo prompt (sub-agente)</h3>
          </div>
          <p className="mb-4 text-[13px] leading-relaxed text-neutral-400">
            Se você mandar uma mensagem com o turno ainda rodando, o Deck dispara um agente leve e barato (Haiku, em modo só-leitura)
            pra classificar a sua mensagem e decidir o melhor destino. São quatro saídas possíveis:
          </p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {TRIAGE.map((t) => (
              <div key={t.label} className={`rounded-xl border p-3 ${t.box}`}>
                <div className={`mb-1 inline-flex rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${t.chip}`}>{t.label}</div>
                <p className="text-[12.5px] leading-relaxed text-neutral-400">{t.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-neutral-500">
            A decisão e o motivo aparecem como uma etiqueta na sua mensagem. Na dúvida, o padrão é sempre <span className="font-medium text-neutral-400">enfileirar</span> — nada se perde.
            Parar o turno (<span className="font-medium text-neutral-400">Esc</span>) significa silêncio: também limpa a fila e cancela qualquer mensagem ainda em triagem.
          </p>
        </Card>
      </div>
    </section>
  );
}
