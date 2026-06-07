import type { ReactNode } from 'react';
import type { Icon } from '../components/primitives';

// Conteúdo estático da página de docs (manual do Deck). Separado do componente
// pra Docs.tsx ficar só com layout/render — os textos vivem aqui como dados.

export type IconName = Parameters<typeof Icon>[0]['name'];

export interface Section {
  id: string;
  label: string;
  icon: IconName;
}

export const SECTIONS: Section[] = [
  { id: 'visao', label: 'Visão geral', icon: 'sparkles' },
  { id: 'features', label: 'Funcionalidades', icon: 'grip' },
  { id: 'sessoes', label: 'Sessões & fila', icon: 'message' },
  { id: 'tempo-real', label: 'Tempo real', icon: 'circle' },
  { id: 'recursos', label: 'Recursos da máquina', icon: 'zap' },
  { id: 'modos', label: 'Modos & permissões', icon: 'shield' },
  { id: 'perfil', label: 'Perfil & aparência', icon: 'user' },
  { id: 'busca', label: 'Busca & navegação', icon: 'search' },
  { id: 'comandos', label: 'Comandos & atalhos', icon: 'command' },
  { id: 'modelos', label: 'Modelos & teto', icon: 'claude' },
  { id: 'admin', label: 'Admin', icon: 'shield' },
  { id: 'bastidores', label: 'Por trás dos panos', icon: 'terminal' },
  { id: 'repo', label: 'Mapa do repositório', icon: 'file' },
];

// Visão de quem desenvolve: o que cada arquivo importante faz. Cada arquivo .ts/.tsx
// listado costuma ter um vizinho .test.ts ao lado (convenção do projeto), omitido aqui.
export const FILEMAP: { group: string; tone: string; files: { path: string; what: string }[] }[] = [
  {
    group: 'Raiz & configuração', tone: 'text-neutral-300 border-neutral-600 bg-neutral-800/60',
    files: [
      { path: 'protocol.ts', what: 'Contrato compartilhado front↔back: tipos de mensagem do WebSocket, modos de permissão, info de modelo, telemetria.' },
      { path: 'index.html', what: 'Casca HTML da SPA — ponto de entrada que o Vite serve e empacota.' },
      { path: 'vite.config.ts', what: 'Configuração do Vite: build, chunks de vendor, dev server em 127.0.0.1.' },
      { path: 'package.json', what: 'Dependências e scripts (dev, build = tsc cliente + tsc servidor + vite).' },
      { path: 'tsconfig*.json', what: 'Configs do TypeScript — uma pro cliente, outra (.server) pro backend Node.' },
      { path: 'vercel.json', what: 'Regras de deploy do front no Vercel (SPA fallback).' },
    ],
  },
  {
    group: 'Frontend · casca & estado', tone: 'text-orange-300 border-orange-500/30 bg-orange-500/10',
    files: [
      { path: 'src/main.tsx', what: 'Bootstrap do React — monta o app na página.' },
      { path: 'src/App.tsx', what: 'Componente raiz: junta header, layouts, rotas e o estado global do cockpit.' },
      { path: 'src/useCockpit.ts', what: 'O cérebro do cliente: conexão WebSocket, sessões, envio de mensagens, telemetria, anexos.' },
      { path: 'src/useRoute.ts', what: 'Roteador minúsculo entre as abas (/, /contextos, /skills, /uso, /admin, /docs).' },
      { path: 'src/app/DesktopLayout.tsx', what: 'Layout de 3 painéis do desktop (sessões · chat · terminais), com recolher/redimensionar.' },
      { path: 'src/app/usePanelResize.ts', what: 'Lógica de arrastar pra redimensionar os painéis laterais.' },
      { path: 'src/app/useGlobalShortcuts.ts', what: 'Atalhos globais de teclado (⌘K, navegação entre sessões, Esc).' },
      { path: 'src/app/useTerminalTabs.ts', what: 'Estado das abas de terminal abertas.' },
    ],
  },
  {
    group: 'Frontend · componentes', tone: 'text-violet-300 border-violet-500/30 bg-violet-500/10',
    files: [
      { path: 'src/components/AppChrome.tsx', what: 'Header, barra de uso do plano, menu de rotas mobile e avisos (offline, quota).' },
      { path: 'src/components/Chat.tsx', what: 'Painel de chat: thread, banners (plano/falha/retomar), botão de terminal, scroll.' },
      { path: 'src/components/Sessions.tsx', what: 'Lista de sessões com busca, ações (favoritar/arquivar/excluir) e seção de arquivadas.' },
      { path: 'src/components/Terminals.tsx', what: 'Painel de terminais com abas, montando o xterm por aba.' },
      { path: 'src/components/Xterm.tsx', what: 'Ponte com a lib xterm.js — desenha os quadros do PTY que chegam pelo WebSocket.' },
      { path: 'src/components/Mobile.tsx', what: 'Layout mobile: chat em tela cheia, drawer de sessões e sheet de terminal.' },
      { path: 'src/components/Avatar.tsx', what: 'Avatares do usuário e da IA + menu de perfil com o seletor de ícone.' },
      { path: 'src/components/aiAvatar.ts', what: 'Presets de ícone da IA (burst da marca + emojis divertidos).' },
      { path: 'src/components/CommandPalette.tsx', what: 'Paleta global de ações (⌘K).' },
      { path: 'src/components/StatusBar.tsx', what: 'Rodapé com telemetria da máquina (CPU/RAM/disco/load).' },
      { path: 'src/components/DocViewer.tsx', what: 'Visualizador de markdown reusado por Contextos e Skills.' },
      { path: 'src/components/primitives.tsx', what: 'Átomos de UI compartilhados: Icon, Badge, render de markdown.' },
    ],
  },
  {
    group: 'Frontend · rotas, lib & núcleo', tone: 'text-sky-300 border-sky-500/30 bg-sky-500/10',
    files: [
      { path: 'src/routes/Contextos.tsx', what: 'Aba Contextos — viewer/busca da memória do agente.' },
      { path: 'src/routes/Skills.tsx', what: 'Aba Skills — habilidades instaladas, compartilháveis.' },
      { path: 'src/routes/Observatorio.tsx', what: 'Aba Uso — custo, tokens, turnos e janela de rate-limit.' },
      { path: 'src/routes/Admin.tsx', what: 'Aba Admin — saúde da máquina, infra e inventário.' },
      { path: 'src/routes/Docs.tsx', what: 'Esta página — o manual do Deck.' },
      { path: 'src/cockpit/blocks.ts', what: 'Monta os blocos de uma mensagem (texto, ferramenta, raciocínio) a partir do stream.' },
      { path: 'src/cockpit/session.ts', what: 'Modelo e helpers de uma sessão no cliente.' },
      { path: 'src/cockpit/evict.ts', what: 'Despejo LRU de threads na memória do cliente pra não crescer sem fim.' },
      { path: 'src/lib/persist.ts', what: 'usePersisted — localStorage com sincronização entre abas/instâncias.' },
      { path: 'src/lib/export.ts', what: 'Exportação de conversa (PDF e outros formatos).' },
      { path: 'src/lib/notify.ts', what: 'Notificações do navegador (turno pronto/falhou).' },
      { path: 'src/lib/format.ts · time.ts', what: 'Formatação de números, custo e tempo relativo.' },
    ],
  },
  {
    group: 'Backend · entrada & WebSocket', tone: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10',
    files: [
      { path: 'server/index.ts', what: 'Sobe o servidor HTTP + WebSocket, liga as rotas e o canal em 127.0.0.1.' },
      { path: 'server/ws.ts', what: 'Aceita conexões WebSocket, autentica origem e despacha eventos.' },
      { path: 'server/ws/dispatch.ts', what: 'Roteia cada tipo de mensagem que chega do cliente pro handler certo.' },
      { path: 'server/ws/runs.ts', what: 'Ciclo de vida dos turnos: fila de prompts, drenagem no fim, broadcast do stream.' },
      { path: 'server/ws/broadcast.ts', what: 'Envia um evento pra todos os clientes conectados (multi-dispositivo).' },
      { path: 'server/ws/terminal-handler.ts', what: 'Liga as abas de terminal aos PTYs reais.' },
      { path: 'server/ws/slash.ts · slash-probe.ts', what: 'Detecta e resolve comandos com barra conhecidos pelo CLI.' },
      { path: 'server/ws/models.ts · usage-plan.ts', what: 'Catálogo de modelos da Anthropic e uso global do plano.' },
      { path: 'server/ws/rate.ts · guard.ts · origin.ts', what: 'Rate-limit, backpressure e checagem de origem do socket.' },
    ],
  },
  {
    group: 'Backend · agente, sessões & dados', tone: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
    files: [
      { path: 'server/engine/claude.ts', what: 'Spawna o Claude headless (stream-json) e traduz a saída em eventos.' },
      { path: 'server/engine/triage.ts', what: 'O sub-agente de triagem do próximo prompt (responder/enfileirar/prioridade/mesclar).' },
      { path: 'server/engine/events.ts', what: 'Tipos e normalização dos eventos do agente.' },
      { path: 'server/sessions/index.ts', what: 'Lista e carrega as sessões a partir dos arquivos JSONL no disco.' },
      { path: 'server/sessions/parse.ts', what: 'Faz o parse do JSONL bruto numa sessão estruturada.' },
      { path: 'server/sessions/search.ts', what: 'Busca por conteúdo dentro das conversas (grep sob demanda).' },
      { path: 'server/store.ts · db.ts', what: 'Cache de sessões e persistência SQLite (metadados, uso).' },
      { path: 'server/contexts.ts · skills.ts', what: 'Leem a memória de contextos e as skills instaladas do disco.' },
      { path: 'server/summary.ts', what: 'Gera o título/resumo destilado de uma sessão.' },
      { path: 'server/health.ts · stats.ts', what: 'Telemetria da máquina (CPU/RAM/disco/GPU/load) lida do SO.' },
      { path: 'server/terminals.ts', what: 'Cria e gerencia os PTYs (shells reais) da VPS.' },
      { path: 'server/auth.ts · oauth.ts', what: 'Credenciais e uso do plano via OAuth (chaves nunca chegam ao cliente).' },
      { path: 'server/attachments.ts · config.ts', what: 'Anexos enviados e configuração/ambiente mínimo do processo.' },
    ],
  },
];

export const RESOURCES: { key: string; label: string; tone: string; what: string; how: string; source: string }[] = [
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

export const SLASH: { cmd: string; desc: string }[] = [
  { cmd: '/help', desc: 'Abre a ajuda de atalhos do app.' },
  { cmd: '/new ou /clear', desc: 'Começa uma sessão nova, limpa.' },
  { cmd: '/model opus', desc: 'Troca o agente desta sessão (opus · sonnet · haiku).' },
  { cmd: '/plan', desc: 'Entra no modo Planejar — só descreve, não executa.' },
  { cmd: '/auto', desc: 'Modo Auto — edita e lê arquivos sozinho, sem shell.' },
  { cmd: '/execute', desc: 'Modo Executar — edita arquivos e roda comandos.' },
  { cmd: '/attcontext', desc: 'Destila o assunto desta sessão e salva na memória de contextos.' },
  { cmd: '/importgpt', desc: 'Importa contextos do export do ChatGPT — anexe o conversations.json e envie.' },
];

export const KEYS: { keys: string[]; desc: string }[] = [
  { keys: ['↵'], desc: 'Envia a mensagem.' },
  { keys: ['⇧', '↵'], desc: 'Quebra linha sem enviar.' },
  { keys: ['⌘', 'K'], desc: 'Paleta de comandos global.' },
  { keys: ['⌘', '/'], desc: 'Foca a barra de busca da aba.' },
  { keys: ['Alt', '↑/↓'], desc: 'Navega entre sessões.' },
  { keys: ['n'], desc: 'Pula pra próxima sessão com novidade.' },
  { keys: ['Esc'], desc: 'Interrompe o turno em andamento.' },
  { keys: ['↑', '↓'], desc: 'Recupera mensagens já enviadas (histórico).' },
];

export const FEATURES: { icon: IconName; tone: string; title: string; body: ReactNode }[] = [
  { icon: 'message', tone: 'text-orange-300 border-orange-500/30 bg-orange-500/10', title: 'Chat', body: 'A conversa principal com o agente. Cada sessão tem seu próprio modelo, modo e histórico. Anexe arquivos, cite mensagens, edite o que mandou e acompanhe o raciocínio e as ferramentas em tempo real. Em sessões longas o app carrega só as mensagens recentes — o botão "carregar antigas" no topo traz o histórico completo (inclui o que veio antes de um /compact).' },
  { icon: 'sparkles', tone: 'text-violet-300 border-violet-500/30 bg-violet-500/10', title: 'Contextos', body: 'A memória do agente em modo leitura. São arquivos markdown tipados (usuário, projeto, feedback, referência) que o agente escreve sozinho e consulta entre conversas. Aqui você vê e pesquisa tudo.' },
  { icon: 'star', tone: 'text-amber-300 border-amber-500/30 bg-amber-500/10', title: 'Skills', body: 'As habilidades instaladas — pacotes de instruções que o agente carrega sob demanda (ex.: spec-driven, squad-review). Visualize cada uma e compartilhe em markdown ou json.' },
  { icon: 'zap', tone: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10', title: 'Uso', body: 'O observatório de consumo: custo estimado, tokens, número de turnos por sessão e a janela de rate-limit do plano. É onde você entende pra onde o orçamento está indo.' },
  { icon: 'shield', tone: 'text-sky-300 border-sky-500/30 bg-sky-500/10', title: 'Admin', body: 'Saúde da máquina e da infra: CPU/RAM/disco, estado do CLI, SSH, MCPs, contagem de sessões e memórias. O painel de controle de quem opera a VPS.' },
  { icon: 'terminal', tone: 'text-neutral-300 border-neutral-600 bg-neutral-800/60', title: 'Terminais', body: 'Shells reais (PTY) da VPS dentro do app, com abas. Multi-dispositivo: o mesmo terminal segue vivo se você abrir de outro aparelho. Bom pra acompanhar o que o agente faz no sistema.' },
];
