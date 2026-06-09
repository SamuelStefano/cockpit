import { Pill, SectionTitle, StepCard, Callout } from '../atoms';

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
          No terminal da sua VPS — com o <Pill>claude</Pill> CLI já logado — cole o comando mostrado (<Pill>curl … agent-setup.sh | bash -s -- CÓDIGO</Pill>), que clona o repo, instala as dependências e pareia.
          O agente gera um par de chaves <span className="font-medium text-neutral-300">Ed25519</span> que <span className="font-medium text-neutral-300">nasce e fica na sua máquina</span> (a privada nunca sai),
          disca o relay e se pareia à sua conta. A tela troca sozinha quando ele conecta.
        </StepCard>
        <StepCard step={3} title="Use de qualquer lugar">
          Pronto. O app puxa o que vive na sua VPS — conta Claude, uso, contextos, skills, sessões.
          Do celular ou de outro PC, basta logar na mesma conta: o relay roteia <span className="font-medium text-neutral-300">por-conta</span>, então só você alcança o seu agente.
        </StepCard>
      </div>
      <Callout icon="shield" tone="amber">
        <span className="font-medium">Capacidade do agente ·</span> por padrão o agente sobe em modo <span className="font-medium">least-capability</span> (chat, sessões e contextos — sem terminais nem admin).
        Pra ter controle total da própria box (terminais reais + painel admin), o dono sobe o agente com <Pill>DECK_AGENT_ROLE=admin</Pill>.
      </Callout>
      <Callout icon="circle" tone="sky">
        <span className="font-medium">Beta · relay confiável.</span> Hoje o relay é operado pela DevFellowship: ele encaminha sua sessão pra sua VPS,
        mas tecnicamente vê o tráfego. A verificação ponta-a-ponta (relay sem poder forjar comandos) entra antes de abrir pra VPSs de terceiros.
      </Callout>
    </section>
  );
}
