import { Pill, SectionTitle, InfoCard } from '../atoms';

export function Realtime() {
  return (
    <section id="tempo-real" className="mb-14 scroll-mt-6">
      <SectionTitle icon="circle" kicker="ao vivo" title="Tempo real entre a VPS e o app"
        desc="Tudo que você vê acontecer sozinho na tela passa por um único canal sempre aberto entre o navegador e o servidor na VPS. Sem recarregar, sem F5 — o estado chega empurrado." />
      <div className="grid gap-3 sm:grid-cols-2">
        <InfoCard icon="zap" title="Um canal, vários fluxos">
          Pela mesma conexão (WebSocket) trafegam: a resposta do agente token a token, a telemetria da máquina,
          as telas dos terminais, a triagem de mensagens e as mudanças nas sessões. Cada fluxo é um tipo de evento etiquetado.
        </InfoCard>
        <InfoCard icon="rotate" iconClass="text-emerald-300" title="Reconexão sem perda">
          Se a conexão cair (rede, app dormindo no celular), o Deck reconecta sozinho e recupera o que aconteceu enquanto esteve fora.
          Um turno iniciado num aparelho continua visível em outro — o estado mora no servidor, não na aba.
        </InfoCard>
        <InfoCard icon="terminal" iconClass="text-neutral-300" title="Terminais multi-dispositivo">
          Os shells reais (PTY) vivem na VPS, não no navegador. Por isso o mesmo terminal segue rodando se você abrir de outro aparelho —
          o app só desenha os quadros que chegam pelo canal.
        </InfoCard>
        <InfoCard icon="circle" iconClass="text-sky-300" title="Indicador de conexão">
          O ponto <Pill>ws</Pill> no cabeçalho mostra o estado do canal em tempo real. Se o backend ficar inacessível,
          um aviso honesto aparece em vez de o app parecer quebrado — e ele continua tentando reconectar.
        </InfoCard>
      </div>
    </section>
  );
}
