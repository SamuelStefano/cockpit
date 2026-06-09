import { Kbd, SectionTitle, InfoCard } from '../atoms';

export function Search() {
  return (
    <section id="busca" className="mb-14 scroll-mt-6">
      <SectionTitle icon="search" kicker="encontrar" title="Busca & navegação"
        desc="Há mais de um tipo de busca — cada uma resolve um problema diferente. Saber qual usar economiza muito tempo." />
      <div className="grid gap-3 sm:grid-cols-2">
        <InfoCard icon="search" title="Barra de busca da aba">
          Aparece no topo de Contextos, Skills e na lista de sessões. Filtra na hora pelo que você digita —
          título, descrição e conteúdo. Atalho <Kbd>⌘</Kbd> <Kbd>/</Kbd> pra focar sem tirar a mão do teclado.
        </InfoCard>
        <InfoCard icon="command" iconClass="text-violet-300" title="Paleta de comandos">
          <Kbd>⌘</Kbd> <Kbd>K</Kbd> abre uma busca global de ações: trocar de aba, criar sessão, mudar de modo,
          pular pra uma sessão rodando, parar tudo. É o caminho mais rápido pra qualquer coisa.
        </InfoCard>
        <InfoCard icon="message" iconClass="text-emerald-300" title="Busca dentro das sessões">
          Procura por uma palavra no conteúdo das conversas antigas (grep sob demanda) e destaca o trecho encontrado —
          pra reachar aquela resposta de dias atrás.
        </InfoCard>
        <InfoCard icon="chevronDown" iconClass="text-sky-300" title="Navegação por teclado">
          <Kbd>Alt</Kbd> <Kbd>↑/↓</Kbd> troca de sessão sem o mouse, e <Kbd>n</Kbd> pula direto pra próxima
          sessão com mensagem nova — útil quando várias rodam ao mesmo tempo.
        </InfoCard>
      </div>
    </section>
  );
}
