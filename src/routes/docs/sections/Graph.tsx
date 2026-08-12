import { SectionTitle, InfoCard, DocFigure, Callout, Pill } from '../atoms';

export function Graph() {
  return (
    <section id="graph" className="mb-14 scroll-mt-6">
      <SectionTitle icon="zap" kicker="knowledge graph" title="Graph — mapa do código"
        desc="A aba /graph constrói um grafo de conhecimento do repositório com tree-sitter — 100% local, sem IA, sem rede. Cada nó é um símbolo (função, classe, variável), cada aresta é uma referência. Útil pra navegar repos grandes, descobrir dependências ocultas e dar contexto estruturado ao agente." />
      <DocFigure src="/docs-graph.jpg" alt="Knowledge graph do repositório cockpit com 3990 nós e 9000 arestas coloridos por comunidade" caption="Grafo do cockpit: 3990 nós · 9000 arestas · 169 comunidades. Cores por comunidade detectada. Arraste, scroll pra zoom, clique num nó pra ver detalhes e vizinhos." />
      <div className="grid gap-3 sm:grid-cols-2">
        <InfoCard icon="zap" title="Geração local (tree-sitter)">
          O backend parseia o repositório com <Pill>tree-sitter</Pill> direto no Node, sem mandar código pra fora.
          O grafo fica em cache em disco e reabre instantaneamente.
        </InfoCard>
        <InfoCard icon="sparkles" iconClass="text-violet-300" title="Comunidades automáticas">
          Um algoritmo de detecção de comunidades agrupa nós fortemente conectados. Cada comunidade ganha
          uma cor e um nome derivado dos símbolos dominantes — fácil distinguir módulos sem ler nomes.
        </InfoCard>
        <InfoCard icon="search" iconClass="text-sky-300" title="Busca e foco">
          Digite na barra de busca pra acender os matches e escurecer o resto. Clique num nó pra ver
          seus vizinhos imediatos; <Pill>Shift+clique</Pill> num segundo nó calcula o caminho entre os dois.
        </InfoCard>
        <InfoCard icon="terminal" iconClass="text-amber-300" title="Query semântica">
          O painel inferior aceita perguntas em linguagem natural sobre o grafo
          (<Pill>curta</Pill> / <Pill>média</Pill> / <Pill>longa</Pill> contexto). O agente lê a estrutura do grafo,
          não os arquivos — é ordens de magnitude mais barato em tokens.
        </InfoCard>
      </div>
      <Callout icon="shield" tone="sky">
        <span className="font-medium">Grafos globais vs. por repo ·</span> o grafo <Pill>todos os apps</Pill> agrega todos os
        repositórios indexados num único grafo navegável. Grafos individuais ficam na lista lateral e podem ser
        excluídos sem afetar os outros.
      </Callout>
    </section>
  );
}
