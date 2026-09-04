import { SectionTitle, InfoCard, Callout, Card } from '../atoms';
import { HARNESS_CHECKS, LEVERS } from '../../../../shared/token-economy';

export function TokenEconomy() {
  return (
    <section id="tokens" className="mb-14 scroll-mt-6">
      <SectionTitle icon="zap" kicker="custo" title="Economia de contexto"
        desc="Todo token que entra na janela é pago em toda mensagem seguinte. O que economiza de verdade não é uma ferramenta a mais — é tirar do caminho o que carrega sempre e quase nunca é usado." />

      <Callout icon="zap" tone="amber">
        O índice de memória é <b>custo fixo O(n)</b>: cada memória nova encarece toda mensagem, pra
        sempre. Um índice de 160 linhas custa ~5k tokens por injeção — e reinjeta a cada compactação —
        pra entregar as 3 linhas que a sessão de fato usa.
      </Callout>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <InfoCard icon="search" title="Roteador, não catálogo">
          O índice lista <span className="font-medium text-neutral-300">domínio → padrão de busca</span>,
          não arquivo por arquivo. O fato se acha sob demanda com um grep (~200 tokens) em vez de
          ser injetado em toda mensagem (~5k tokens).
        </InfoCard>
        <InfoCard icon="star" title="Durável × perecível">
          Regra de comportamento muda o que o agente faz <b>antes</b> de agir: fica no índice, escrita
          por extenso. Fato de projeto é estado e apodrece: sai do índice, vira busca.
        </InfoCard>
        <InfoCard icon="clock" title="Teto por arquivo">
          Nenhuma memória passa de ~2KB. Sem teto, um único recall pode custar 20k tokens — mais que
          a tarefa inteira.
        </InfoCard>
        <InfoCard icon="message" title="Arquivar, nunca apagar">
          O que sai do recall vai pra um diretório de arquivo: continua no disco e continua
          grep-ável. Nada se perde e nada custa.
        </InfoCard>
      </div>

      <h3 className="mt-6 mb-2 text-sm font-medium text-neutral-300">Alavancas, por ganho</h3>
      <Card>
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="text-neutral-500">
              <th className="pb-2 font-medium">Alavanca</th>
              <th className="pb-2 font-medium">Ganho</th>
            </tr>
          </thead>
          <tbody className="text-neutral-400">
            {LEVERS.map((l) => (
              <tr key={l.name} className="border-t border-neutral-800/60">
                <td className="py-1.5 pr-4 text-neutral-300">{l.name}</td>
                <td className="py-1.5">{l.gain}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <h3 className="mt-6 mb-2 text-sm font-medium text-neutral-300">Verificação de harness</h3>
      <p className="mb-3 text-[13px] text-neutral-500">
        Os pontos abaixo são o que um agente deve auditar num setup — o seu ou o de outra pessoa.
        Cada item é uma pergunta que se responde lendo arquivo, sem adivinhar.
      </p>
      <div className="grid gap-2">
        {HARNESS_CHECKS.map((c) => (
          <Card key={c.id} className="text-[13px]">
            <div className="font-medium text-neutral-300">{c.title}</div>
            <div className="mt-0.5 text-neutral-500">{c.why}</div>
            <code className="mt-1.5 block overflow-x-auto rounded bg-neutral-900/70 px-2 py-1 text-[12px] text-orange-300/90">{c.probe}</code>
          </Card>
        ))}
      </div>
    </section>
  );
}
