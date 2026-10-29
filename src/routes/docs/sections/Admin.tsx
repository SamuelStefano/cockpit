import { Pill, SectionTitle, InfoCard, Callout } from '../atoms';

export function Admin() {
  return (
    <section id="admin" className="mb-14 scroll-mt-6">
      <SectionTitle icon="shield" kicker="operação" title="Administração"
        desc="Quem opera a VPS usa Configurações → Máquina (saúde, inventário e operações no host), Configurações → Pessoas (contas e admin) e Conexões. A leitura está sempre à mão; contas e operações no host ficam só com o root." />
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
          Só o root vê e usa — comandos rodam por argumentos (sem shell), não por concatenação de texto.
        </InfoCard>
        <InfoCard icon="shield" iconClass="text-amber-300" title="Token de acesso">
          Defina a variável <Pill>COCKPIT_TOKEN</Pill> no servidor e o Deck passa a exigir esse token na entrada (modo loopback/rede privada).
          Pelo relay, o acesso é por <span className="font-medium text-neutral-300">conta</span>. Em qualquer caso o token nunca é exposto: viaja só na conexão e fica no navegador.
        </InfoCard>
      </div>
      <InfoCard icon="terminal" title="Agente externo como worker">
        Turno roda sem TTY: <Pill>acceptEdits</Pill> nega Bash. Worker precisa de allow list em <Pill>~/.claude/settings.json</Pill> ou bypass.
        MCP: o turno usa <Pill>--strict-mcp-config</Pill> e só carrega os escolhidos do <Pill>~/.claude.json</Pill>; <Pill>.mcp.json</Pill> do diretório é ignorado.
        Skills: selecionar qualquer uma bloqueia as demais. <Pill>imported-*</Pill> é do Deck; sync externo não deve tocar.
        Enviar e ler por script: <Pill>deckctl send</Pill>, <Pill>deckctl wait</Pill>, <Pill>deckctl read</Pill>.
      </InfoCard>
      <Callout icon="shield" tone="red">
        <span className="font-medium">Default-deny por papel ·</span> as telas de administração ficam escondidas pra quem não é admin, Host e Contas só aparecem pro root, e o backend nega toda
        ação administrativa que não venha do papel certo — qualquer comando novo já entra negado por padrão até ser liberado explicitamente.
      </Callout>
    </section>
  );
}
