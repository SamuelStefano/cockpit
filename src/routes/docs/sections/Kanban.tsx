import { SectionTitle, InfoCard, Callout, Pill } from '../atoms';

export function Kanban() {
  return (
    <section id="kanban" className="mb-14 scroll-mt-6">
      <SectionTitle icon="grip" kicker="canvas" title="Canvas & kanban — status das sessões"
        desc="A aba /canvas (admin) mostra cada sessão como um item de kanban. O status sai do estado vivo da sessão, não de um campo salvo: o que está rodando fica em In progress sozinho, e só o que terminou de verdade cai em Done." />
      <div className="grid gap-3 sm:grid-cols-2">
        <InfoCard icon="circle" iconClass="text-orange-300" title="Como o status é lido">
          <Pill>In progress</Pill> = turno rodando no Deck, esperando você, último turno quebrou, ou
          shell <Pill>cockpit-cv-*</Pill> vivo. <Pill>Done</Pill> = o agente fechou o turno limpo e ninguém conferiu.
          <Pill>Completed</Pill> = você marcou. Arrastar vale até a sessão se mexer de novo.
        </InfoCard>
        <InfoCard icon="terminal" iconClass="text-fuchsia-300" title="Workers em shell tmux">
          Um <Pill>claude</Pill> rodando num shell <Pill>cockpit-cv-*</Pill> não passa por turno do Deck. O servidor
          lê <Pill>~/.claude/sessions/&lt;pid&gt;.json</Pill> (sessionId, tmux, busy/idle) a cada 5s e marca viva
          a sessão com tmux + processo ocupado, ou transcript escrito há menos de 2 min. Ela entra na faixa
          <Pill>Orchestrator</Pill>.
        </InfoCard>
        <InfoCard icon="message" iconClass="text-sky-300" title="Gaveta do item">
          Clique num item: status, primeira mensagem, <Pill>Last message</Pill> (fim da última resposta do agente) e
          <Pill>Links</Pill> — PRs primeiro, depois URLs citadas pelo agente. Relê o transcript quando a sessão mexe.
        </InfoCard>
        <InfoCard icon="sparkles" iconClass="text-amber-300" title="Triagem">
          Parado há mais de 24h sem pendência sai do quadro. Done antigo vai pra <Pill>antigos</Pill>, no fim da coluna.
          <Pill>ocultar</Pill> na gaveta tira a sessão até você mostrar tudo de novo.
        </InfoCard>
      </div>
      <Callout icon="shield" tone="amber">
        <span className="font-medium">Dependência frágil ·</span> o registro <Pill>~/.claude/sessions</Pill> é interno do
        Claude Code e não é documentado. Se o formato mudar, o worker em shell volta a aparecer como Done enquanto roda.
        A liveness mora em <Pill>server/canvas/cv-liveness.ts</Pill>.
      </Callout>
    </section>
  );
}
