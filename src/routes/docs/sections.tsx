import { Icon } from '../../components/primitives';
import { FILEMAP, RESOURCES, SLASH, KEYS, FEATURES } from '../docs.data';
import { SectionTitle, Card, FeatureCard, Pill, Kbd, ResourceRow } from './atoms';

// Conteúdo estático da documentação (hero + seções + rodapé). É manual de uso,
// sem dados do backend. Separado de Docs.tsx pra manter o arquivo de layout/lógica
// (scrollspy + nav) enxuto; aqui mora só o texto/render.

export function DocSections({ year }: { year: number }) {
  return (
    <>
      {/* Hero */}
      <div className="mb-12 overflow-hidden rounded-3xl border border-neutral-800 bg-gradient-to-br from-orange-500/[0.08] via-neutral-900/40 to-neutral-950 p-7 sm:p-9">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-[11px] font-medium text-orange-300">
          <Icon name="terminal" size={12} /> Deck
        </div>
        <h1 className="text-[30px] font-bold leading-tight tracking-tight text-neutral-50 sm:text-[36px]">
          Seu posto de comando<br className="hidden sm:block" /> pra trabalhar com o Claude.
        </h1>
        <p className="mt-4 max-w-2xl text-[14.5px] leading-relaxed text-neutral-400">
          O Deck é uma interface pessoal que roda na sua VPS pra conversar com o agente,
          acompanhar a máquina em tempo real, gerenciar contextos e abrir terminais — tudo num lugar só.
          Esta página explica cada peça, do botão de busca ao que acontece nos bastidores.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {['Tempo real', 'Roda local (127.0.0.1)', 'Memória persistente', 'Terminais reais'].map((t) => (
            <span key={t} className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-2.5 py-1 text-[11.5px] text-neutral-400">{t}</span>
          ))}
        </div>
      </div>

      {/* Visão geral */}
      <section id="visao" className="mb-14 scroll-mt-6">
        <SectionTitle icon="sparkles" kicker="o básico" title="O que é o Deck"
          desc="Um app web que conecta você a um agente Claude rodando na sua máquina. Pense nele como o deck de comando de uma nave: vários painéis à mão, cada um cuidando de uma parte da operação." />
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-orange-400/80">Conversa</div>
            <p className="text-[13px] leading-relaxed text-neutral-400">Você escreve, o agente responde, edita arquivos e roda comandos — conforme o modo que você escolher.</p>
          </Card>
          <Card>
            <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-violet-400/80">Memória</div>
            <p className="text-[13px] leading-relaxed text-neutral-400">O agente guarda contexto entre conversas em arquivos que você pode ler e pesquisar na aba Contextos.</p>
          </Card>
          <Card>
            <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-sky-400/80">Operação</div>
            <p className="text-[13px] leading-relaxed text-neutral-400">Telemetria da VPS, terminais reais e painel de saúde pra você ver e controlar o que está acontecendo.</p>
          </Card>
        </div>
      </section>

      {/* Funcionalidades */}
      <section id="features" className="mb-14 scroll-mt-6">
        <SectionTitle icon="grip" kicker="as abas" title="Funcionalidades"
          desc="Cada aba no topo é uma área de trabalho independente. A conexão com o agente nunca cai ao trocar de aba — você navega livre sem perder nada." />
        <div className="grid gap-3 sm:grid-cols-2">
          {FEATURES.map((f) => <FeatureCard key={f.title} icon={f.icon} tone={f.tone} title={f.title}>{f.body}</FeatureCard>)}
        </div>
      </section>

      {/* Sessões & fila */}
      <section id="sessoes" className="mb-14 scroll-mt-6">
        <SectionTitle icon="message" kicker="organização" title="Sessões & fila de prompts"
          desc="Cada conversa é uma sessão que você pode favoritar, renomear ou arquivar. E quando você manda uma mensagem enquanto o agente ainda trabalha, um segundo agente decide o que fazer com ela — você não precisa esperar." />
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <div className="mb-2 flex items-center gap-2">
              <Icon name="star" size={15} className="text-amber-300" />
              <h3 className="text-[14px] font-semibold text-neutral-100">Ações da sessão</h3>
            </div>
            <p className="text-[13px] leading-relaxed text-neutral-400">
              Passe o mouse sobre uma sessão na lista pra ver os botões: <span className="font-medium text-neutral-300">favoritar</span> (fixa no topo),
              <span className="font-medium text-neutral-300"> renomear</span>, <span className="font-medium text-neutral-300">arquivar</span> e <span className="font-medium text-neutral-300">excluir</span>.
              O arquivado some da lista mas continua no disco; o excluído é escondido do Deck — o histórico real em arquivo nunca é apagado de fato.
            </p>
          </Card>
          <Card>
            <div className="mb-2 flex items-center gap-2">
              <Icon name="sparkles" size={15} className="text-violet-300" />
              <h3 className="text-[14px] font-semibold text-neutral-100">Resumo & contexto</h3>
            </div>
            <p className="text-[13px] leading-relaxed text-neutral-400">
              Cada sessão mostra um título destilado pelo agente e um medidor de quanto da janela de contexto já foi usado.
              Quando o contexto enche, o botão de <span className="font-medium text-neutral-300">nova sessão</span> dá um recomeço limpo sem perder o histórico antigo.
            </p>
          </Card>
        </div>
        <div className="mt-3">
          <Card className="border-orange-500/20">
            <div className="mb-3 flex items-center gap-2">
              <Icon name="claude" size={15} className="text-orange-300" />
              <h3 className="text-[14px] font-semibold text-neutral-100">Triagem do próximo prompt (sub-agente)</h3>
            </div>
            <p className="mb-4 text-[13px] leading-relaxed text-neutral-400">
              Se você mandar uma mensagem com o turno ainda rodando, o Deck dispara um agente leve e barato (Haiku, em modo só-leitura)
              pra classificar a sua mensagem e decidir o melhor destino. São quatro saídas possíveis:
            </p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3">
                <div className="mb-1 inline-flex rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-emerald-300">responder</div>
                <p className="text-[12.5px] leading-relaxed text-neutral-400">Pergunta trivial e independente — é respondida na hora num balão lateral, sem atrapalhar o turno principal.</p>
              </div>
              <div className="rounded-xl border border-sky-500/25 bg-sky-500/[0.06] p-3">
                <div className="mb-1 inline-flex rounded-md bg-sky-500/20 px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-sky-300">enfileirar</div>
                <p className="text-[12.5px] leading-relaxed text-neutral-400">Complementa o trabalho atual — fica na fila e é enviada sozinha assim que o turno termina.</p>
              </div>
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3">
                <div className="mb-1 inline-flex rounded-md bg-amber-500/20 px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-amber-300">prioridade</div>
                <p className="text-[12.5px] leading-relaxed text-neutral-400">Urgente ou corrige o rumo — interrompe o turno em andamento e entra na frente.</p>
              </div>
              <div className="rounded-xl border border-violet-500/25 bg-violet-500/[0.06] p-3">
                <div className="mb-1 inline-flex rounded-md bg-violet-500/20 px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-violet-300">mesclar</div>
                <p className="text-[12.5px] leading-relaxed text-neutral-400">É continuação do mesmo assunto — tratada como parte do turno atual.</p>
              </div>
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-neutral-500">
              A decisão e o motivo aparecem como uma etiqueta na sua mensagem. Na dúvida, o padrão é sempre <span className="font-medium text-neutral-400">enfileirar</span> — nada se perde.
              Parar o turno (<span className="font-medium text-neutral-400">Esc</span>) significa silêncio: também limpa a fila e cancela qualquer mensagem ainda em triagem.
            </p>
          </Card>
        </div>
      </section>

      {/* Tempo real */}
      <section id="tempo-real" className="mb-14 scroll-mt-6">
        <SectionTitle icon="circle" kicker="ao vivo" title="Tempo real entre a VPS e o app"
          desc="Tudo que você vê acontecer sozinho na tela passa por um único canal sempre aberto entre o navegador e o servidor na VPS. Sem recarregar, sem F5 — o estado chega empurrado." />
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <div className="mb-2 flex items-center gap-2">
              <Icon name="zap" size={15} className="text-orange-300" />
              <h3 className="text-[14px] font-semibold text-neutral-100">Um canal, vários fluxos</h3>
            </div>
            <p className="text-[13px] leading-relaxed text-neutral-400">
              Pela mesma conexão (WebSocket) trafegam: a resposta do agente token a token, a telemetria da máquina,
              as telas dos terminais, a triagem de mensagens e as mudanças nas sessões. Cada fluxo é um tipo de evento etiquetado.
            </p>
          </Card>
          <Card>
            <div className="mb-2 flex items-center gap-2">
              <Icon name="rotate" size={15} className="text-emerald-300" />
              <h3 className="text-[14px] font-semibold text-neutral-100">Reconexão sem perda</h3>
            </div>
            <p className="text-[13px] leading-relaxed text-neutral-400">
              Se a conexão cair (rede, app dormindo no celular), o Deck reconecta sozinho e recupera o que aconteceu enquanto esteve fora.
              Um turno iniciado num aparelho continua visível em outro — o estado mora no servidor, não na aba.
            </p>
          </Card>
          <Card>
            <div className="mb-2 flex items-center gap-2">
              <Icon name="terminal" size={15} className="text-neutral-300" />
              <h3 className="text-[14px] font-semibold text-neutral-100">Terminais multi-dispositivo</h3>
            </div>
            <p className="text-[13px] leading-relaxed text-neutral-400">
              Os shells reais (PTY) vivem na VPS, não no navegador. Por isso o mesmo terminal segue rodando se você abrir de outro aparelho —
              o app só desenha os quadros que chegam pelo canal.
            </p>
          </Card>
          <Card>
            <div className="mb-2 flex items-center gap-2">
              <Icon name="circle" size={15} className="text-sky-300" />
              <h3 className="text-[14px] font-semibold text-neutral-100">Indicador de conexão</h3>
            </div>
            <p className="text-[13px] leading-relaxed text-neutral-400">
              O ponto <Pill>ws</Pill> no cabeçalho mostra o estado do canal em tempo real. Se o backend ficar inacessível,
              um aviso honesto aparece em vez de o app parecer quebrado — e ele continua tentando reconectar.
            </p>
          </Card>
        </div>
      </section>

      {/* Conectar de outro aparelho */}
      <section id="conexao" className="mb-14 scroll-mt-6">
        <SectionTitle icon="terminal" kicker="acesso remoto" title="Conectar a sua VPS"
          desc="O Deck que você abre no navegador é só a tela; o cérebro roda na sua VPS. Você pareia a VPS à sua conta uma única vez — depois é só logar de qualquer aparelho que ela te segue, sem expor nada na internet." />
        <div className="space-y-3">
          <Card>
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-orange-500/15 text-[11px] font-semibold text-orange-300">1</span>
              <h3 className="text-[14px] font-semibold text-neutral-100">Entre na sua conta</h3>
            </div>
            <p className="text-[13px] leading-relaxed text-neutral-400">
              Abra o Deck e faça login. Enquanto nenhuma VPS sua estiver pareada e online, aparece a tela
              <span className="font-medium text-neutral-300"> “conectar sua VPS”</span> com um comando de uma linha e um código de pareamento.
            </p>
          </Card>
          <Card>
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-orange-500/15 text-[11px] font-semibold text-orange-300">2</span>
              <h3 className="text-[14px] font-semibold text-neutral-100">Rode o agente na VPS</h3>
            </div>
            <p className="text-[13px] leading-relaxed text-neutral-400">
              No terminal da sua VPS — com o <Pill>claude</Pill> CLI já logado — cole o comando mostrado (<Pill>curl … agent-setup.sh | bash -s -- CÓDIGO</Pill>), que clona o repo, instala as dependências e pareia.
              O agente gera um par de chaves <span className="font-medium text-neutral-300">Ed25519</span> que <span className="font-medium text-neutral-300">nasce e fica na sua máquina</span> (a privada nunca sai),
              disca o relay e se pareia à sua conta. A tela troca sozinha quando ele conecta.
            </p>
          </Card>
          <Card>
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-orange-500/15 text-[11px] font-semibold text-orange-300">3</span>
              <h3 className="text-[14px] font-semibold text-neutral-100">Use de qualquer lugar</h3>
            </div>
            <p className="text-[13px] leading-relaxed text-neutral-400">
              Pronto. O app puxa o que vive na sua VPS — conta Claude, uso, contextos, skills, sessões.
              Do celular ou de outro PC, basta logar na mesma conta: o relay roteia <span className="font-medium text-neutral-300">por-conta</span>, então só você alcança o seu agente.
            </p>
          </Card>
        </div>
        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
          <Icon name="shield" size={15} className="mt-0.5 shrink-0 text-amber-400/80" />
          <p className="text-[12.5px] leading-relaxed text-amber-200/80">
            <span className="font-medium">Capacidade do agente ·</span> por padrão o agente sobe em modo <span className="font-medium">least-capability</span> (chat, sessões e contextos — sem terminais nem admin).
            Pra ter controle total da própria box (terminais reais + painel admin), o dono sobe o agente com <Pill>DECK_AGENT_ROLE=admin</Pill>.
          </p>
        </div>
        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-sky-500/20 bg-sky-500/[0.06] p-4">
          <Icon name="circle" size={15} className="mt-0.5 shrink-0 text-sky-400/80" />
          <p className="text-[12.5px] leading-relaxed text-sky-200/80">
            <span className="font-medium">Beta · relay confiável.</span> Hoje o relay é operado pela DevFellowship: ele encaminha sua sessão pra sua VPS,
            mas tecnicamente vê o tráfego. A verificação ponta-a-ponta (relay sem poder forjar comandos) entra antes de abrir pra VPSs de terceiros.
          </p>
        </div>
      </section>

      {/* Recursos da máquina */}
      <section id="recursos" className="mb-14 scroll-mt-6">
        <SectionTitle icon="zap" kicker="telemetria" title="Recursos da máquina"
          desc="Os medidores no rodapé e no Admin mostram a saúde da VPS em tempo real. Tudo é lido direto do sistema operacional, sem instalar nada — leituras best-effort que nunca derrubam o app." />
        <div className="space-y-3">
          {RESOURCES.map((r) => <ResourceRow key={r.key} r={r} />)}
        </div>
        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
          <Icon name="zap" size={15} className="mt-0.5 shrink-0 text-amber-400/80" />
          <p className="text-[12.5px] leading-relaxed text-amber-200/80">
            <span className="font-medium">Watchdog automático ·</span> se CPU ou RAM ficarem saturadas por tempo demais,
            o Deck sinaliza e pode agir pra evitar travar a máquina inteira.
          </p>
        </div>
      </section>

      {/* Modos & permissões */}
      <section id="modos" className="mb-14 scroll-mt-6">
        <SectionTitle icon="shield" kicker="controle" title="Modos & permissões"
          desc="Você decide quanta liberdade o agente tem em cada sessão. Do mais cauteloso ao mais autônomo — o seletor fica logo acima do campo de mensagem." />
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="border-neutral-700">
            <div className="mb-2 inline-flex rounded-md bg-neutral-800 px-2 py-1 text-[11px] font-medium text-neutral-100">Planejar</div>
            <p className="text-[13px] leading-relaxed text-neutral-400">O agente só descreve o plano. Nada é editado nem executado. Ideal pra alinhar a abordagem antes.</p>
          </Card>
          <Card className="border-amber-500/30">
            <div className="mb-2 inline-flex rounded-md bg-amber-500/20 px-2 py-1 text-[11px] font-medium text-amber-300">Auto</div>
            <p className="text-[13px] leading-relaxed text-neutral-400">Edita e lê arquivos sozinho, mas não roda comandos no shell. Bom meio-termo pra mexer em código.</p>
          </Card>
          <Card className="border-orange-500/30">
            <div className="mb-2 inline-flex rounded-md bg-orange-500/20 px-2 py-1 text-[11px] font-medium text-orange-300">Executar</div>
            <p className="text-[13px] leading-relaxed text-neutral-400">Liberdade total dentro das regras: edita arquivos e roda comandos. O modo de trabalho de verdade.</p>
          </Card>
        </div>
        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-red-500/25 bg-red-500/[0.07] p-4">
          <Icon name="shield-off" size={15} className="mt-0.5 shrink-0 text-red-400/80" />
          <p className="text-[12.5px] leading-relaxed text-red-200/80">
            <span className="font-medium">Bypass (admin) ·</span> um interruptor que deixa o agente rodar qualquer comando sem pedir aprovação.
            Vem desligado, é restrito a administrador e deve ser usado com muito cuidado — desligue assim que terminar.
          </p>
        </div>
      </section>

      {/* Perfil & aparência */}
      <section id="perfil" className="mb-14 scroll-mt-6">
        <SectionTitle icon="user" kicker="personalização" title="Perfil & aparência"
          desc="O Deck é seu — dá pra dar cara a você e ao agente. Tudo fica salvo localmente no seu navegador (nada vai pro servidor) e o menu de perfil mora no canto direito do cabeçalho." />
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <div className="mb-2 flex items-center gap-2">
              <Icon name="user" size={15} className="text-orange-300" />
              <h3 className="text-[14px] font-semibold text-neutral-100">Seu avatar e nome</h3>
            </div>
            <p className="text-[13px] leading-relaxed text-neutral-400">
              Defina seu nome (usado nas iniciais do chat) e envie uma foto de avatar. A imagem é reduzida no próprio navegador
              e guardada localmente — sem upload pra lugar nenhum. Sem foto, o app usa suas iniciais.
            </p>
          </Card>
          <Card>
            <div className="mb-2 flex items-center gap-2">
              <Icon name="sparkles" size={15} className="text-violet-300" />
              <h3 className="text-[14px] font-semibold text-neutral-100">Ícone da IA</h3>
            </div>
            <p className="text-[13px] leading-relaxed text-neutral-400">
              Dentro do menu de perfil há um seletor escondido pro ícone do agente: o burst laranja da marca por padrão,
              ou um dos vários emojis divertidos (caranguejo, robô, alienígena, raposa…). Escolha um e ele passa a aparecer em todas as respostas.
            </p>
          </Card>
        </div>
      </section>

      {/* Busca & navegação */}
      <section id="busca" className="mb-14 scroll-mt-6">
        <SectionTitle icon="search" kicker="encontrar" title="Busca & navegação"
          desc="Há mais de um tipo de busca — cada uma resolve um problema diferente. Saber qual usar economiza muito tempo." />
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <div className="mb-2 flex items-center gap-2">
              <Icon name="search" size={15} className="text-orange-300" />
              <h3 className="text-[14px] font-semibold text-neutral-100">Barra de busca da aba</h3>
            </div>
            <p className="text-[13px] leading-relaxed text-neutral-400">
              Aparece no topo de Contextos, Skills e na lista de sessões. Filtra na hora pelo que você digita —
              título, descrição e conteúdo. Atalho <Kbd>⌘</Kbd> <Kbd>/</Kbd> pra focar sem tirar a mão do teclado.
            </p>
          </Card>
          <Card>
            <div className="mb-2 flex items-center gap-2">
              <Icon name="command" size={15} className="text-violet-300" />
              <h3 className="text-[14px] font-semibold text-neutral-100">Paleta de comandos</h3>
            </div>
            <p className="text-[13px] leading-relaxed text-neutral-400">
              <Kbd>⌘</Kbd> <Kbd>K</Kbd> abre uma busca global de ações: trocar de aba, criar sessão, mudar de modo,
              pular pra uma sessão rodando, parar tudo. É o caminho mais rápido pra qualquer coisa.
            </p>
          </Card>
          <Card>
            <div className="mb-2 flex items-center gap-2">
              <Icon name="message" size={15} className="text-emerald-300" />
              <h3 className="text-[14px] font-semibold text-neutral-100">Busca dentro das sessões</h3>
            </div>
            <p className="text-[13px] leading-relaxed text-neutral-400">
              Procura por uma palavra no conteúdo das conversas antigas (grep sob demanda) e destaca o trecho encontrado —
              pra reachar aquela resposta de dias atrás.
            </p>
          </Card>
          <Card>
            <div className="mb-2 flex items-center gap-2">
              <Icon name="chevronDown" size={15} className="text-sky-300" />
              <h3 className="text-[14px] font-semibold text-neutral-100">Navegação por teclado</h3>
            </div>
            <p className="text-[13px] leading-relaxed text-neutral-400">
              <Kbd>Alt</Kbd> <Kbd>↑/↓</Kbd> troca de sessão sem o mouse, e <Kbd>n</Kbd> pula direto pra próxima
              sessão com mensagem nova — útil quando várias rodam ao mesmo tempo.
            </p>
          </Card>
        </div>
      </section>

      {/* Comandos & atalhos */}
      <section id="comandos" className="mb-14 scroll-mt-6">
        <SectionTitle icon="command" kicker="produtividade" title="Comandos & atalhos"
          desc="Comandos com barra (/) controlam a sessão direto do campo de mensagem; atalhos de teclado aceleram o resto. O app interpreta os comandos conhecidos localmente — o que ele não reconhece vai pro agente como texto." />
        <div className="grid gap-3 lg:grid-cols-2">
          <Card>
            <div className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-neutral-400">
              <Icon name="terminal" size={13} /> Comandos com barra
            </div>
            <div className="space-y-2.5">
              {SLASH.map((s) => (
                <div key={s.cmd} className="flex items-baseline gap-3">
                  <span className="shrink-0"><Pill>{s.cmd}</Pill></span>
                  <span className="text-[12.5px] leading-snug text-neutral-400">{s.desc}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <div className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-neutral-400">
              <Icon name="command" size={13} /> Atalhos de teclado
            </div>
            <div className="space-y-2.5">
              {KEYS.map((k) => (
                <div key={k.desc} className="flex items-center justify-between gap-3">
                  <span className="text-[12.5px] leading-snug text-neutral-400">{k.desc}</span>
                  <span className="flex shrink-0 items-center gap-1">{k.keys.map((key) => <Kbd key={key}>{key}</Kbd>)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* Modelos & teto */}
      <section id="modelos" className="mb-14 scroll-mt-6">
        <SectionTitle icon="claude" kicker="o agente" title="Modelos & teto de gasto"
          desc="Cada sessão escolhe qual versão do agente usar e quanto pode gastar. As versões são puxadas direto da Anthropic, então a lista fica sempre atualizada." />
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <div className="mb-2 flex items-center gap-2">
              <Icon name="claude" size={15} className="text-orange-300" />
              <h3 className="text-[14px] font-semibold text-neutral-100">Versão do agente</h3>
            </div>
            <p className="text-[13px] leading-relaxed text-neutral-400">
              O seletor <span className="font-medium text-neutral-300">versão</span> lista os modelos disponíveis
              (Opus, Sonnet, Haiku) na release mais recente. Opus é o mais capaz; Haiku, o mais rápido e barato.
              A lista vem do catálogo oficial da Anthropic — quando sai uma versão nova, ela aparece sozinha.
            </p>
          </Card>
          <Card>
            <div className="mb-2 flex items-center gap-2">
              <Icon name="zap" size={15} className="text-emerald-300" />
              <h3 className="text-[14px] font-semibold text-neutral-100">Teto por turno ($)</h3>
            </div>
            <p className="text-[13px] leading-relaxed text-neutral-400">
              O campo <span className="font-medium text-neutral-300">teto</span> define um limite de gasto em dólares
              por turno. Ao atingir o valor, o turno para sozinho — uma rede de segurança contra um run que dispara o custo.
              Vazio = sem limite.
            </p>
          </Card>
        </div>
      </section>

      {/* Admin */}
      <section id="admin" className="mb-14 scroll-mt-6">
        <SectionTitle icon="shield" kicker="operação" title="Tela de Admin"
          desc="O posto de controle de quem opera a VPS: saúde da máquina, inventário, gestão de contas e operações no host. A leitura está sempre à mão; as ações de escrita são restritas e ficam visíveis só pra quem é admin." />
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <div className="mb-2 flex items-center gap-2">
              <Icon name="zap" size={15} className="text-emerald-300" />
              <h3 className="text-[14px] font-semibold text-neutral-100">Saúde & inventário</h3>
            </div>
            <p className="text-[13px] leading-relaxed text-neutral-400">
              CPU, RAM, disco e carga em tempo real, mais o estado do CLI do Claude, SSH, MCPs, plugins, tmux
              e contagem de sessões, contextos e skills. Tokens do ambiente aparecem <span className="font-medium text-neutral-300">só pelo nome</span> — nunca o valor.
            </p>
          </Card>
          <Card>
            <div className="mb-2 flex items-center gap-2">
              <Icon name="user" size={15} className="text-violet-300" />
              <h3 className="text-[14px] font-semibold text-neutral-100">Contas</h3>
            </div>
            <p className="text-[13px] leading-relaxed text-neutral-400">
              Lista de contas com acesso e um interruptor de <span className="font-medium text-neutral-300">admin</span> por conta.
              Conceder/revogar admin é restrito ao <span className="font-medium text-neutral-300">root</span> (definido por variável de ambiente no servidor, não no banco).
            </p>
          </Card>
          <Card>
            <div className="mb-2 flex items-center gap-2">
              <Icon name="terminal" size={15} className="text-orange-300" />
              <h3 className="text-[14px] font-semibold text-neutral-100">Operações no host</h3>
            </div>
            <p className="text-[13px] leading-relaxed text-neutral-400">
              Direto do browser: definir/remover <span className="font-medium text-neutral-300">tokens de ambiente</span>,
              adicionar/remover <span className="font-medium text-neutral-300">servidores MCP</span> e instalar <span className="font-medium text-neutral-300">CLIs</span> na máquina.
              Tudo gated por admin — comandos rodam por argumentos (sem shell), não por concatenação de texto.
            </p>
          </Card>
          <Card>
            <div className="mb-2 flex items-center gap-2">
              <Icon name="shield" size={15} className="text-amber-300" />
              <h3 className="text-[14px] font-semibold text-neutral-100">Token de acesso</h3>
            </div>
            <p className="text-[13px] leading-relaxed text-neutral-400">
              Defina a variável <Pill>COCKPIT_TOKEN</Pill> no servidor e o Deck passa a exigir esse token na entrada (modo loopback/rede privada).
              Pelo relay, o acesso é por <span className="font-medium text-neutral-300">conta</span>. Em qualquer caso o token nunca é exposto: viaja só na conexão e fica no navegador.
            </p>
          </Card>
        </div>
        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-red-500/25 bg-red-500/[0.07] p-4">
          <Icon name="shield" size={15} className="mt-0.5 shrink-0 text-red-400/80" />
          <p className="text-[12.5px] leading-relaxed text-red-200/80">
            <span className="font-medium">Default-deny por papel ·</span> a rota Admin fica escondida pra quem não é admin, e o backend nega toda
            ação administrativa que não venha de um admin — qualquer comando novo já entra negado por padrão até ser liberado explicitamente.
          </p>
        </div>
      </section>

      {/* Por trás dos panos */}
      <section id="bastidores" className="mb-10 scroll-mt-6">
        <SectionTitle icon="terminal" kicker="arquitetura" title="Por trás dos panos"
          desc="Como tudo se encaixa, em linguagem simples. Você não precisa saber disto pra usar — mas ajuda a entender por que algumas coisas funcionam do jeito que funcionam." />
        <div className="space-y-3">
          <Card>
            <div className="mb-2 flex items-center gap-2">
              <Icon name="circle" size={13} className="text-orange-400" />
              <h3 className="text-[14px] font-semibold text-neutral-100">Duas partes, uma conexão</h3>
            </div>
            <p className="text-[13px] leading-relaxed text-neutral-400">
              A interface (o que você vê) conversa com um servidor na VPS por um único canal em tempo real (WebSocket).
              É por ele que chegam respostas, telemetria, telas de terminal e atualizações de sessão — tudo ao vivo, sem recarregar a página.
            </p>
          </Card>
          <Card>
            <div className="mb-2 flex items-center gap-2">
              <Icon name="claude" size={13} className="text-orange-400" />
              <h3 className="text-[14px] font-semibold text-neutral-100">O agente é o Claude de verdade</h3>
            </div>
            <p className="text-[13px] leading-relaxed text-neutral-400">
              O servidor inicia o Claude em modo headless e transmite a resposta token a token enquanto ela acontece.
              Por isso você vê o texto e as ferramentas surgindo aos poucos, como num terminal.
            </p>
          </Card>
          <Card>
            <div className="mb-2 flex items-center gap-2">
              <Icon name="file" size={13} className="text-orange-400" />
              <h3 className="text-[14px] font-semibold text-neutral-100">Suas conversas são arquivos</h3>
            </div>
            <p className="text-[13px] leading-relaxed text-neutral-400">
              Cada sessão é gravada em disco como histórico estruturado. O Deck apenas lê e lista esses arquivos —
              ele não reescreve o seu histórico real. Fechar a aba não perde nada: ao voltar, a conversa é recarregada.
            </p>
          </Card>
          <Card>
            <div className="mb-2 flex items-center gap-2">
              <Icon name="shield" size={13} className="text-orange-400" />
              <h3 className="text-[14px] font-semibold text-neutral-100">Privado por padrão</h3>
            </div>
            <p className="text-[13px] leading-relaxed text-neutral-400">
              O servidor escuta só em <Pill>127.0.0.1</Pill> (a própria máquina), acessível remotamente apenas via rede privada.
              Chaves de API e tokens ficam no servidor e nunca são enviados pro navegador — só números calculados (uso, custo) e nomes de modelo chegam à tela.
            </p>
          </Card>
        </div>
      </section>

      {/* Mapa do repositório */}
      <section id="repo" className="mb-10 scroll-mt-6">
        <SectionTitle icon="file" kicker="para desenvolvedores" title="Mapa do repositório"
          desc="A vista de quem mexe no código: o que cada arquivo importante faz, agrupado por área. A maioria dos arquivos tem um vizinho .test ao lado (convenção do projeto), omitido aqui pra não poluir." />
        <div className="space-y-5">
          {FILEMAP.map((g) => (
            <Card key={g.group}>
              <div className="mb-3 flex items-center gap-2">
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg border ${g.tone}`}>
                  <Icon name="file" size={13} />
                </span>
                <h3 className="text-[13.5px] font-semibold text-neutral-100">{g.group}</h3>
              </div>
              <div className="space-y-2">
                {g.files.map((f) => (
                  <div key={f.path} className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
                    <span className="shrink-0 sm:w-60"><Pill>{f.path}</Pill></span>
                    <span className="text-[12.5px] leading-snug text-neutral-400">{f.what}</span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </section>

      <div className="border-t border-neutral-800/80 pt-6 text-center text-[11px] text-neutral-600">
        Deck · manual interno · {year}
      </div>
    </>
  );
}
