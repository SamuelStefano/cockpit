import { Pill, SectionTitle, InfoCard, Callout } from '../atoms';

export function Admin() {
  return (
    <section id="admin" className="mb-14 scroll-mt-6">
      <SectionTitle icon="shield" kicker="operação" title="Tela de Admin"
        desc="O posto de controle de quem opera a VPS: saúde da máquina, inventário, gestão de contas e operações no host. A leitura está sempre à mão; as ações de escrita são restritas e ficam visíveis só pra quem é admin." />
      <div className="grid gap-3 sm:grid-cols-2">
        <InfoCard icon="zap" iconClass="text-emerald-300" title="Saúde & inventário">
          CPU, RAM, disco e carga em tempo real, mais o estado do CLI do Claude, SSH, MCPs, plugins, tmux
          e contagem de sessões, contextos e skills. Tokens do ambiente aparecem <span className="font-medium text-neutral-300">só pelo nome</span> — nunca o valor.
        </InfoCard>
        <InfoCard icon="user" iconClass="text-violet-300" title="Contas">
          Lista de contas com acesso e um interruptor de <span className="font-medium text-neutral-300">admin</span> por conta.
          Conceder/revogar admin é restrito ao <span className="font-medium text-neutral-300">root</span> (definido por variável de ambiente no servidor, não no banco).
        </InfoCard>
        <InfoCard icon="terminal" title="Operações no host">
          Direto do browser: definir/remover <span className="font-medium text-neutral-300">tokens de ambiente</span>,
          adicionar/remover <span className="font-medium text-neutral-300">servidores MCP</span> e instalar <span className="font-medium text-neutral-300">CLIs</span> na máquina.
          Tudo gated por admin — comandos rodam por argumentos (sem shell), não por concatenação de texto.
        </InfoCard>
        <InfoCard icon="shield" iconClass="text-amber-300" title="Token de acesso">
          Defina a variável <Pill>COCKPIT_TOKEN</Pill> no servidor e o Deck passa a exigir esse token na entrada (modo loopback/rede privada).
          Pelo relay, o acesso é por <span className="font-medium text-neutral-300">conta</span>. Em qualquer caso o token nunca é exposto: viaja só na conexão e fica no navegador.
        </InfoCard>
      </div>
      <Callout icon="shield" tone="red">
        <span className="font-medium">Default-deny por papel ·</span> a rota Admin fica escondida pra quem não é admin, e o backend nega toda
        ação administrativa que não venha de um admin — qualquer comando novo já entra negado por padrão até ser liberado explicitamente.
      </Callout>
    </section>
  );
}
