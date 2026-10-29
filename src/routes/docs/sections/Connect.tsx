import { CodeBlock } from '../../../components/primitives';
import { COMMAND_DOES, COMMAND_DOES_NOT, RELAY_SEES, RELAY_SOON, SETUP_SOURCE_URL } from '../../../components/auth/install-facts';
import { Pill, SectionTitle, StepCard, Callout } from '../atoms';

const SETUP_URL = 'https://raw.githubusercontent.com/SamuelStefano/cockpit/main/scripts/agent-setup.sh';
const SETUP_CMD = `curl -fsSL ${SETUP_URL} | sudo DECK_ISOLATED=1 DECK_PAIR_CODE=CÓDIGO bash`;
const SETUP_CMD_DEDICATED = `curl -fsSL ${SETUP_URL} | DECK_PAIR_CODE=CÓDIGO bash`;

export function Connect() {
  return (
    <section id="conexao" className="mb-14 scroll-mt-6">
      <SectionTitle icon="terminal" kicker="acesso remoto" title="Conectar a sua VPS"
        desc="O Deck que você abre no navegador é só a tela; o cérebro roda na sua VPS. Você pareia a VPS à sua conta uma única vez — depois é só logar de qualquer aparelho que ela te segue, sem expor nada na internet." />
      <div className="space-y-3">
        <StepCard step={1} title="Entre na sua conta">
          Abra o Deck e faça login. Enquanto nenhuma VPS sua estiver pareada e online, aparece a tela
          <span className="font-medium text-neutral-300"> “conectar sua VPS”</span> com um comando de uma linha e um código de pareamento.
        </StepCard>
        <StepCard step={2} title="Rode o agente na VPS">
          No terminal da sua VPS, cole o comando mostrado na tela (troque <Pill>CÓDIGO</Pill> pelo seu código de pareamento). Há dois modos:
          <span className="mt-2 block"><span className="font-medium text-neutral-300">Isolado (recomendado)</span> — pra uma VPS que já roda outras coisas. O agente roda num usuário <Pill>deck</Pill> separado, sem sudo; sua conta, seu Node e seus pacotes ficam intactos. O sudo é usado só pra criar o usuário e o serviço.</span>
          <CodeBlock code={SETUP_CMD} lang="bash" />
          <span className="block"><span className="font-medium text-neutral-300">VPS dedicada</span> — pra uma box só do Deck: instala no seu próprio usuário. Pra controle total (terminais e admin) rode com <Pill>DECK_AGENT_ROLE=admin</Pill>.</span>
          <CodeBlock code={SETUP_CMD_DEDICATED} lang="bash" />
          O script <span className="font-medium text-neutral-300">reaproveita o que a sua VPS já tem</span> (Node 20+, <Pill>claude</Pill> CLI) e instala só o que faltar, sempre dentro do seu HOME — não troca o Node do sistema e não faz npm global.
          Pra ver o plano sem instalar nada, rode com <Pill>DECK_DRY_RUN=1</Pill>. Depois clona o repo, instala as dependências, pareia e deixa o agente como serviço <span className="font-medium text-neutral-300">systemd</span> — sobrevive a reboot (sem systemd, cai pro nohup e sobrevive só ao fechamento do SSH).
          O <span className="font-medium text-neutral-300">watchdog anti-travamento</span> é opcional (<Pill>DECK_VPS_GUARD=1</Pill>): se a VPS travar de carga, ele mata os processos vilões e, persistindo, derruba as sessões de terminal (tmux).
          O agente gera um par de chaves <span className="font-medium text-neutral-300">Ed25519</span> que <span className="font-medium text-neutral-300">nasce e fica na sua máquina</span> (a privada nunca sai),
          disca o relay e se pareia à sua conta. A tela troca sozinha quando ele conecta.
        </StepCard>
        <StepCard step={3} title="Logue o Claude CLI (se for a primeira vez)">
          O cérebro do Deck é o <Pill>claude</Pill> rodando na sua conta Anthropic. Se a VPS nunca teve o CLI logado,
          rode <Pill>claude</Pill> uma vez no terminal e abra a URL que aparecer no seu navegador — só precisa fazer isso uma vez por máquina.
        </StepCard>
        <StepCard step={4} title="Use de qualquer lugar">
          Pronto. O app puxa o que vive na sua VPS — conta Claude, uso, contextos, skills, sessões.
          Do celular ou de outro PC, basta logar na mesma conta: o relay roteia <span className="font-medium text-neutral-300">por-conta</span>, então só você alcança o seu agente.
        </StepCard>
      </div>
      <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-950/60 p-4 text-[13px] leading-relaxed text-neutral-400">
        <p className="font-medium text-neutral-200">O que o comando faz</p>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          {COMMAND_DOES.map((t) => <li key={t}>{t}</li>)}
          {COMMAND_DOES_NOT.map((t) => <li key={t}>{t}</li>)}
        </ul>
        <p className="mt-2">
          Leia antes de rodar: <a href={SETUP_SOURCE_URL} target="_blank" rel="noopener noreferrer" className="text-orange-300 underline underline-offset-2">scripts/agent-setup.sh no GitHub</a>.
        </p>
        <p className="mt-4 font-medium text-neutral-200">O que o relay vê</p>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          {RELAY_SEES.map((t) => <li key={t}>{t}</li>)}
        </ul>
        <p className="mt-2 text-neutral-500">{RELAY_SOON}</p>
      </div>
      <Callout icon="shield" tone="amber">
        <span className="font-medium">Capacidade do agente ·</span> por padrão o agente sobe em modo <span className="font-medium">least-capability</span> (chat, sessões e contextos — sem terminais nem admin).
        Pra ter controle total da própria box (terminais reais + Configurações de administração), o dono sobe o agente com <Pill>DECK_AGENT_ROLE=admin</Pill>.
      </Callout>
      <Callout icon="circle" tone="sky">
        <span className="font-medium">Beta · relay confiável.</span> Hoje o relay é operado pela DevFellowship: ele encaminha sua sessão pra sua VPS,
        mas tecnicamente vê o tráfego. A verificação ponta-a-ponta (relay sem poder forjar comandos) entra antes de abrir pra VPSs de terceiros.
      </Callout>
    </section>
  );
}
