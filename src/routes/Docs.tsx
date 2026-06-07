import { useState, useEffect, useRef, useMemo } from 'react';
import { Icon } from '../components/primitives';

// Documentação do app, 100% client-side (conteúdo estático). Uma rota só, com
// navegação por seções (scrollspy) à esquerda e cartões explicativos. Sem dados
// do backend: é manual de uso, sempre disponível mesmo offline.

type IconName = Parameters<typeof Icon>[0]['name'];

interface Section {
  id: string;
  label: string;
  icon: IconName;
}

const SECTIONS: Section[] = [
  { id: 'visao', label: 'Visão geral', icon: 'sparkles' },
  { id: 'features', label: 'Funcionalidades', icon: 'grip' },
  { id: 'recursos', label: 'Recursos da máquina', icon: 'zap' },
  { id: 'modos', label: 'Modos & permissões', icon: 'shield' },
  { id: 'busca', label: 'Busca & navegação', icon: 'search' },
  { id: 'comandos', label: 'Comandos & atalhos', icon: 'command' },
  { id: 'modelos', label: 'Modelos & teto', icon: 'claude' },
  { id: 'bastidores', label: 'Por trás dos panos', icon: 'terminal' },
];

// --- Átomos de layout ------------------------------------------------------

function SectionTitle({ icon, kicker, title, desc }: { icon: IconName; kicker: string; title: string; desc: string }) {
  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-orange-500/30 bg-orange-500/10 text-orange-300">
          <Icon name={icon} size={17} />
        </span>
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-orange-400/70">{kicker}</span>
      </div>
      <h2 className="text-[22px] font-semibold tracking-tight text-neutral-100">{title}</h2>
      <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-neutral-400">{desc}</p>
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5 transition hover:border-neutral-700/80 ${className}`}>
      {children}
    </div>
  );
}

function FeatureCard({ icon, tone, title, children }: { icon: IconName; tone: string; title: string; children: React.ReactNode }) {
  return (
    <Card className="group">
      <div className="mb-3 flex items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${tone}`}>
          <Icon name={icon} size={18} />
        </span>
        <h3 className="text-[14.5px] font-semibold text-neutral-100">{title}</h3>
      </div>
      <p className="text-[13px] leading-relaxed text-neutral-400">{children}</p>
    </Card>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return <code className="rounded-md border border-neutral-700/60 bg-neutral-950 px-1.5 py-0.5 font-mono text-[11.5px] text-orange-300/90">{children}</code>;
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="inline-flex min-w-[22px] items-center justify-center rounded-md border border-neutral-700 bg-neutral-950 px-1.5 py-0.5 font-mono text-[11px] text-neutral-300 shadow-[0_1px_0_rgba(0,0,0,0.6)]">{children}</kbd>;
}

// --- Recursos da máquina (CPU/RAM/Disco/GPU/Load) --------------------------

const RESOURCES: { key: string; label: string; tone: string; what: string; how: string; source: string }[] = [
  {
    key: 'CPU', label: 'Processador', tone: 'text-sky-300 border-sky-500/30 bg-sky-500/10',
    what: 'Quanto do poder de cálculo da máquina está sendo usado agora, de 0 a 100%. Alto e constante = algo pesado rodando (build, agente, vídeo).',
    how: 'O backend lê dois "retratos" do tempo de CPU com um intervalo entre eles e calcula a fração que NÃO ficou ociosa. Por isso o número é uma média do último instante, não um pico solto.',
    source: '/proc/stat',
  },
  {
    key: 'RAM', label: 'Memória', tone: 'text-violet-300 border-violet-500/30 bg-violet-500/10',
    what: 'A memória de trabalho de curto prazo. Tudo que está aberto vive aqui. Encheu = a máquina começa a usar disco como memória (swap) e fica lenta.',
    how: 'Lê o total instalado e a memória realmente disponível; o usado é a diferença entre os dois. Usa "disponível" (e não "livre") porque conta cache que pode ser liberado na hora.',
    source: '/proc/meminfo',
  },
  {
    key: 'SSD', label: 'Disco', tone: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10',
    what: 'O armazenamento permanente — o que sobrevive a um reboot. Sessões, contextos, dependências e logs moram aqui. Cheio = nada novo é gravado.',
    how: 'Pergunta ao sistema de arquivos da sua pasta pessoal o total de blocos e quantos estão livres; multiplica pelo tamanho do bloco pra virar bytes. Usado = total − livre.',
    source: 'statfs($HOME)',
  },
  {
    key: 'GPU', label: 'Placa de vídeo', tone: 'text-pink-300 border-pink-500/30 bg-pink-500/10',
    what: 'A aceleradora gráfica/IA, quando existe. Aparece só em máquinas com GPU NVIDIA. Útil pra ver carga de inferência ou render.',
    how: 'Chama a ferramenta da NVIDIA pedindo utilização e memória. Se a máquina não tem GPU, a leitura falha uma vez e o medidor some — sem retentar à toa.',
    source: 'nvidia-smi',
  },
  {
    key: 'LOAD', label: 'Carga (load)', tone: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
    what: 'Quantos processos estão em fila esperando a CPU, em média no último minuto. Acima do nº de núcleos = há mais trabalho do que mãos pra fazer.',
    how: 'Lê o load average de 1 minuto que o próprio kernel mantém. É um termômetro de "fila de espera", complementar ao % de CPU.',
    source: '/proc/loadavg',
  },
];

function ResourceRow({ r }: { r: typeof RESOURCES[number] }) {
  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex shrink-0 items-center gap-3 sm:w-44">
          <span className={`flex h-12 w-12 items-center justify-center rounded-xl border font-mono text-[12px] font-bold ${r.tone}`}>
            {r.key}
          </span>
          <div>
            <div className="text-[14px] font-semibold text-neutral-100">{r.label}</div>
            <div className="mt-0.5 text-[10.5px] text-neutral-500">fonte: <Pill>{r.source}</Pill></div>
          </div>
        </div>
        <div className="flex-1 space-y-2.5">
          <p className="text-[13px] leading-relaxed text-neutral-300"><span className="font-medium text-neutral-200">O que é · </span>{r.what}</p>
          <p className="text-[12.5px] leading-relaxed text-neutral-500"><span className="font-medium text-neutral-400">Como é puxado · </span>{r.how}</p>
        </div>
      </div>
    </Card>
  );
}

// --- Comandos & atalhos ----------------------------------------------------

const SLASH: { cmd: string; desc: string }[] = [
  { cmd: '/help', desc: 'Abre a ajuda de atalhos do app.' },
  { cmd: '/new ou /clear', desc: 'Começa uma sessão nova, limpa.' },
  { cmd: '/model opus', desc: 'Troca o agente desta sessão (opus · sonnet · haiku).' },
  { cmd: '/plan', desc: 'Entra no modo Planejar — só descreve, não executa.' },
  { cmd: '/auto', desc: 'Modo Auto — edita e lê arquivos sozinho, sem shell.' },
  { cmd: '/execute', desc: 'Modo Executar — edita arquivos e roda comandos.' },
];

const KEYS: { keys: string[]; desc: string }[] = [
  { keys: ['↵'], desc: 'Envia a mensagem.' },
  { keys: ['⇧', '↵'], desc: 'Quebra linha sem enviar.' },
  { keys: ['⌘', 'K'], desc: 'Paleta de comandos global.' },
  { keys: ['⌘', '/'], desc: 'Foca a barra de busca da aba.' },
  { keys: ['Alt', '↑/↓'], desc: 'Navega entre sessões.' },
  { keys: ['n'], desc: 'Pula pra próxima sessão com novidade.' },
  { keys: ['Esc'], desc: 'Interrompe o turno em andamento.' },
  { keys: ['↑', '↓'], desc: 'Recupera mensagens já enviadas (histórico).' },
];

// --- Funcionalidades -------------------------------------------------------

const FEATURES: { icon: IconName; tone: string; title: string; body: React.ReactNode }[] = [
  { icon: 'message', tone: 'text-orange-300 border-orange-500/30 bg-orange-500/10', title: 'Chat', body: 'A conversa principal com o agente. Cada sessão tem seu próprio modelo, modo e histórico. Anexe arquivos, cite mensagens, edite o que mandou e acompanhe o raciocínio e as ferramentas em tempo real.' },
  { icon: 'sparkles', tone: 'text-violet-300 border-violet-500/30 bg-violet-500/10', title: 'Contextos', body: 'A memória do agente em modo leitura. São arquivos markdown tipados (usuário, projeto, feedback, referência) que o agente escreve sozinho e consulta entre conversas. Aqui você vê e pesquisa tudo.' },
  { icon: 'star', tone: 'text-amber-300 border-amber-500/30 bg-amber-500/10', title: 'Skills', body: 'As habilidades instaladas — pacotes de instruções que o agente carrega sob demanda (ex.: spec-driven, squad-review). Visualize cada uma e compartilhe em markdown ou json.' },
  { icon: 'zap', tone: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10', title: 'Uso', body: 'O observatório de consumo: custo estimado, tokens, número de turnos por sessão e a janela de rate-limit do plano. É onde você entende pra onde o orçamento está indo.' },
  { icon: 'shield', tone: 'text-sky-300 border-sky-500/30 bg-sky-500/10', title: 'Admin', body: 'Saúde da máquina e da infra: CPU/RAM/disco, estado do CLI, SSH, MCPs, contagem de sessões e memórias. O painel de controle de quem opera a VPS.' },
  { icon: 'terminal', tone: 'text-neutral-300 border-neutral-600 bg-neutral-800/60', title: 'Terminais', body: 'Shells reais (PTY) da VPS dentro do app, com abas. Multi-dispositivo: o mesmo terminal segue vivo se você abrir de outro aparelho. Bom pra acompanhar o que o agente faz no sistema.' },
];

// --- Página ----------------------------------------------------------------

export function Docs() {
  const [active, setActive] = useState(SECTIONS[0].id);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scrollspy: a seção mais alta visível vira a ativa no menu lateral.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { root, rootMargin: '-15% 0px -70% 0px', threshold: 0 },
    );
    SECTIONS.forEach((s) => { const el = document.getElementById(s.id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);

  const jump = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActive(id);
  };

  const year = useMemo(() => new Date().getFullYear(), []);

  return (
    <div className="flex min-h-0 flex-1 bg-neutral-950">
      {/* Nav lateral (scrollspy) — só desktop */}
      <aside className="hidden w-60 shrink-0 border-r border-neutral-800/80 lg:block">
        <div className="sticky top-0 p-4">
          <div className="mb-4 px-2">
            <div className="font-mono text-[15px] font-semibold lowercase tracking-tight text-neutral-100">documentação</div>
            <div className="mt-0.5 text-[11px] text-neutral-500">manual do cockpit</div>
          </div>
          <nav className="space-y-0.5">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => jump(s.id)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] transition
                  ${active === s.id ? 'bg-orange-500/15 font-medium text-orange-300' : 'text-neutral-500 hover:bg-neutral-900 hover:text-neutral-300'}`}
              >
                <Icon name={s.icon} size={14} className="shrink-0" />
                {s.label}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Conteúdo */}
      <div ref={scrollRef} className="scroll-thin flex-1 overflow-y-auto scroll-smooth">
        {/* Chips de navegação — só mobile */}
        <div className="sticky top-0 z-10 border-b border-neutral-800/80 bg-neutral-950/90 px-4 py-2.5 backdrop-blur lg:hidden">
          <div className="scroll-thin flex gap-1.5 overflow-x-auto">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => jump(s.id)}
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] transition
                  ${active === s.id ? 'border-orange-500/40 bg-orange-500/15 text-orange-300' : 'border-neutral-800 text-neutral-500'}`}
              >
                <Icon name={s.icon} size={12} /> {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-10">
          {/* Hero */}
          <div className="mb-12 overflow-hidden rounded-3xl border border-neutral-800 bg-gradient-to-br from-orange-500/[0.08] via-neutral-900/40 to-neutral-950 p-7 sm:p-9">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-[11px] font-medium text-orange-300">
              <Icon name="terminal" size={12} /> cockpit
            </div>
            <h1 className="text-[30px] font-bold leading-tight tracking-tight text-neutral-50 sm:text-[36px]">
              Seu posto de comando<br className="hidden sm:block" /> pra trabalhar com o Claude.
            </h1>
            <p className="mt-4 max-w-2xl text-[14.5px] leading-relaxed text-neutral-400">
              O cockpit é uma interface pessoal que roda na sua VPS pra conversar com o agente,
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
            <SectionTitle icon="sparkles" kicker="o básico" title="O que é o cockpit"
              desc="Um app web que conecta você a um agente Claude rodando na sua máquina. Pense nele como o cockpit de um avião: vários painéis à mão, cada um cuidando de uma parte da operação." />
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
                o cockpit sinaliza e pode agir pra evitar travar a máquina inteira.
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
                  Cada sessão é gravada em disco como histórico estruturado. O cockpit apenas lê e lista esses arquivos —
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

          <div className="border-t border-neutral-800/80 pt-6 text-center text-[11px] text-neutral-600">
            cockpit · manual interno · {year}
          </div>
        </div>
      </div>
    </div>
  );
}
