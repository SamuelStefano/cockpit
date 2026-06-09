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
        <InfoCard icon="shield" iconClass="text-orange-400" size={13} title="Privado por padrão">
          O servidor escuta só em <Pill>127.0.0.1</Pill> (a própria máquina), acessível remotamente apenas via rede privada.
          Chaves de API e tokens ficam no servidor e nunca são enviados pro navegador — só números calculados (uso, custo) e nomes de modelo chegam à tela.
        </InfoCard>
      </div>
    </section>
  );
}
