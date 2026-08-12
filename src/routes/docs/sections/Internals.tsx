import { SectionTitle, InfoCard, Pill } from '../atoms';

export function Internals() {
  return (
    <section id="bastidores" className="mb-10 scroll-mt-6">
      <SectionTitle icon="terminal" kicker="arquitetura" title="Por trás dos panos"
        desc="Como tudo se encaixa, em linguagem simples. Você não precisa saber disto pra usar — mas ajuda a entender por que algumas coisas funcionam do jeito que funcionam." />
      <div className="space-y-3">
        <InfoCard icon="circle" iconClass="text-orange-400" size={13} title="Duas partes, uma conexão">
          A interface (o que você vê) conversa com um servidor na VPS por um único canal em tempo real (WebSocket).
          É por ele que chegam respostas, telemetria, telas de terminal e atualizações de sessão — tudo ao vivo, sem recarregar a página.
        </InfoCard>
        <InfoCard icon="claude" iconClass="text-orange-400" size={13} title="O agente é o Claude de verdade">
          O servidor inicia o Claude em modo headless e transmite a resposta token a token enquanto ela acontece.
          Por isso você vê o texto e as ferramentas surgindo aos poucos, como num terminal.
        </InfoCard>
        <InfoCard icon="file" iconClass="text-orange-400" size={13} title="Suas conversas são arquivos">
          Cada sessão é gravada em disco como histórico estruturado. O Deck apenas lê e lista esses arquivos —
          ele não reescreve o seu histórico real. Fechar a aba não perde nada: ao voltar, a conversa é recarregada.
        </InfoCard>
        <InfoCard icon="rotate" iconClass="text-orange-400" size={13} title="Sempre no código mais novo">
          O backend e o agente ficam sob supervisores que os reerguem se caírem. Quando o código do <Pill>main</Pill> muda
          mexendo no servidor, um gatilho automático reinicia os dois na hora — então uma correção nunca fica presa num processo
          rodando código de dias atrás (era a causa de "consertei mas continua igual").
        </InfoCard>
        <InfoCard icon="rotate" iconClass="text-orange-400" size={13} title="Turno que cai volta sozinho">
          Se o processo do turno morre antes de responder — queda, reinício do agente, falta de memória — o chat não fica mudo:
          aparece um aviso e o turno é <b>retomado do ponto onde parou</b> com <Pill>--resume</Pill>, mantendo modelo, modo e orçamento.
          Os turnos vivos ficam registrados em disco, então até um reinício do servidor é recuperado no próximo arranque.
          A retomada tem teto: se falhar de novo, o Deck avisa em vez de insistir.
        </InfoCard>
        <InfoCard icon="shield" iconClass="text-orange-400" size={13} title="Uma IA vigia as falhas">
          Toda falha de turno vira uma linha em <Pill>~/.cockpit/incidents.jsonl</Pill> — só fato estrutural (duração, nº de ferramentas),
          nunca o texto da conversa. De 15 em 15 minutos, se houver incidente novo, um Claude headless acorda, investiga a causa raiz
          e abre uma <b>PR com a correção</b>. Ele não pode reiniciar nada nem commitar na <Pill>main</Pill>: você revisa antes.
          Sem incidente, não roda — custo zero quando está tudo bem.
        </InfoCard>
        <InfoCard icon="clock" iconClass="text-orange-400" size={13} title="Sessões ociosas hibernam">
          Sessão sem resposta há mais de 24h é encerrada automaticamente pra liberar a memória da VPS — mas
          <Pill>sem perder nada</Pill>: o histórico fica salvo em disco e a conversa volta inteira com
          <Pill>claude --resume</Pill>. Evita que várias janelas esquecidas travem a RAM.
        </InfoCard>
        <InfoCard icon="clock" iconClass="text-orange-400" size={13} title="Crons — prompts agendados">
          A aba <Pill>Crons</Pill> dispara prompts em horário marcado como turnos autônomos:
          <Pill>diário</Pill> num horário, a cada <Pill>N minutos</Pill> ou <Pill>uma vez</Pill> numa data e
          hora (esse se pausa sozinho depois de rodar). Cada disparo vira a sessão <Pill>cron-&lt;id&gt;</Pill>.
          Pausável, com "rodar agora". O agendador roda no backend; persistido em <Pill>~/.cockpit/crons.json</Pill>.
        </InfoCard>
        <InfoCard icon="pencil" iconClass="text-orange-400" size={13} title="Notas viram contexto">
          A aba <Pill>Notas</Pill> é um rascunho livre salvo automaticamente — joga ideias soltas, links, trechos.
          Quando acumular, o botão <b>Analisar com IA</b> manda tudo pro chat pra destilar num contexto/memória
          estruturado, que aparece na aba Contextos.
        </InfoCard>
        <InfoCard icon="command" iconClass="text-orange-400" size={13} title="MCP só quando você liga">
          Por padrão o chat roda <Pill>sem MCP</Pill> — os servidores MCP carregam dezenas de definições de
          ferramenta por mensagem (tokens à toa em conversa comum). No compositor há um seletor <b>MCP</b>:
          ligue por sessão só os que aquela tarefa precisa (supabase, plans, etc.). Vazio = nenhum, mais barato.
        </InfoCard>
        <InfoCard icon="shield" iconClass="text-orange-400" size={13} title="Privado por padrão">
          O servidor escuta só em <Pill>127.0.0.1</Pill> (a própria máquina), acessível remotamente apenas via rede privada.
          Chaves de API e tokens ficam no servidor e nunca são enviados pro navegador — só números calculados (uso, custo) e nomes de modelo chegam à tela.
        </InfoCard>
      </div>
    </section>
  );
}
