export interface AppTemplate { id: string; label: string; code: string }

const BOTOES = `export default function App() {
  const [salvando, setSalvando] = React.useState(false);
  const variantes = ['primary', 'secondary', 'outline', 'ghost', 'danger'];
  return (
    <div className="min-h-full bg-neutral-950 p-6">
      <h2 className={'mb-4 text-[15px] font-semibold ' + tokens.text.primary}>Botões — variantes, tamanhos e estados</h2>
      <div className="flex flex-col gap-2.5">
        {variantes.map((v) => (
          <div key={v} className="flex flex-wrap items-center gap-2">
            <span className="w-20 shrink-0 text-[12px] text-neutral-500">{v}</span>
            <Button variant={v} size="sm" icon="play">sm</Button>
            <Button variant={v} size="md" icon="plus">md</Button>
            <Button variant={v} square icon="x" title="fechar" />
            <Button variant={v} size="sm" square icon="copy" title="copiar" />
            <Button variant={v} loading>carregando</Button>
            <Button variant={v} disabled icon="trash">desabilitado</Button>
            <Button variant={v} ripple icon="arrowUp" iconRight>ripple</Button>
          </div>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button loading={salvando} icon="check" onClick={() => { setSalvando(true); window.setTimeout(() => setSalvando(false), 1500); }}>
          Salvar por 1,5s
        </Button>
        <div className="w-48 border border-dashed border-neutral-700 p-2">
          <Button variant="outline" icon="file">Rótulo absurdamente longo que testa truncagem dentro de um container estreito</Button>
        </div>
      </div>
    </div>
  );
}`;

const BADGES = `export default function App() {
  const tones = ['neutral', 'orange', 'green', 'red', 'yellow'];
  const estados = ['connected', 'reconnecting', 'down'];
  const longo = 'etiqueta com um texto exageradamente longo que serve pra ver se a pílula quebra, estoura ou trunca';
  return (
    <div className="min-h-full bg-neutral-950 p-6">
      <h2 className={'mb-4 text-[15px] font-semibold ' + tokens.text.primary}>Badges & status</h2>
      <div className="flex flex-wrap items-center gap-2">
        {tones.map((t) => <Badge key={t} tone={t}>{t}</Badge>)}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {tones.map((t) => <Badge key={t} tone={t} dot>{t} · com dot</Badge>)}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge>1</Badge>
        <Badge tone="orange" dot>9999999</Badge>
        <Badge tone="red">!</Badge>
      </div>
      <div className={'mt-4 w-56 p-3 ' + tokens.surface.base + ' ' + tokens.radius.md}>
        <Badge tone="yellow" dot>{longo}</Badge>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-6">
        {estados.map((s) => <ConnDot key={s} label={'canal ' + s} state={s} />)}
        <ConnDot label="modo compacto" state="reconnecting" compact />
      </div>
    </div>
  );
}`;

const FORMULARIO = `export default function App() {
  const [email, setEmail] = React.useState('');
  const [enviando, setEnviando] = React.useState(false);
  const erro = email.length > 0 && !email.includes('@');
  const enviar = () => {
    if (erro) { toast('E-mail inválido', { tone: 'error' }); return; }
    setEnviando(true);
    window.setTimeout(() => { setEnviando(false); toast('Cadastro enviado'); }, 1200);
  };
  return (
    <div className="min-h-full bg-neutral-950 p-6">
      <h2 className={'mb-4 text-[15px] font-semibold ' + tokens.text.primary}>Formulário</h2>
      <div className={'flex max-w-md flex-col gap-3 p-4 ' + tokens.surface.base + ' ' + tokens.radius.lg}>
        <Input placeholder="voce@exemplo.com" value={email} error={erro} icon="user" onChange={(e) => setEmail(e.target.value)} />
        <Input size="sm" icon="search" placeholder="buscar…" suffix={<span className="font-mono text-[10.5px] text-orange-300">{email.length}</span>} />
        <Input mono defaultValue="wss://deck.exemplo.com/socket/um/caminho/bem/comprido/pra/testar/overflow" />
        <Input type="password" defaultValue="segredo" />
        <Input disabled placeholder="campo desabilitado" />
        <Input error defaultValue="valor inválido fixo" />
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={() => setEmail('')}>Limpar</Button>
          <Button icon="send" loading={enviando} onClick={enviar}>Enviar</Button>
        </div>
      </div>
    </div>
  );
}`;

const MODAL = `export default function App() {
  const [aberto, setAberto] = React.useState(false);
  const [semTitulo, setSemTitulo] = React.useState(false);
  const paragrafos = Array.from({ length: 24 }).map((_, i) => 'Parágrafo ' + (i + 1) + ' — conteúdo suficiente pra forçar rolagem interna e revelar bug de foco, scroll lock ou altura máxima do corpo do modal.');
  return (
    <div className="min-h-full bg-neutral-950 p-6">
      <h2 className={'mb-4 text-[15px] font-semibold ' + tokens.text.primary}>Modal com conteúdo longo</h2>
      <div className="flex flex-wrap gap-2">
        <Button icon="grip" onClick={() => setAberto(true)}>Abrir modal longo</Button>
        <Button variant="outline" onClick={() => setSemTitulo(true)}>Abrir sem título</Button>
      </div>
      <p className="mt-3 text-[12px] text-neutral-500">Role a página por trás com o modal aberto pra checar o scroll lock.</p>
      <div className="mt-4 h-[600px] rounded-xl border border-dashed border-neutral-800" />
      <Modal
        open={aberto}
        onClose={() => setAberto(false)}
        title="Título comprido o bastante pra truncar no cabeçalho do diálogo"
        icon="pencil"
        maxWidth="max-w-xl"
        footer={<><Button variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button><Button onClick={() => setAberto(false)}>Salvar</Button></>}
      >
        <div className="flex flex-col gap-3 text-[13px] text-neutral-400">
          {paragrafos.map((p, i) => <p key={i}>{p}</p>)}
        </div>
      </Modal>
      <Modal open={semTitulo} onClose={() => setSemTitulo(false)}>
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-neutral-400">Sem cabeçalho: não existe botão de fechar. Só Esc ou clique-fora.</p>
          <Button variant="secondary" onClick={() => setSemTitulo(false)}>Fechar</Button>
        </div>
      </Modal>
    </div>
  );
}`;

const TABS = `export default function App() {
  const poucas = [
    { id: 'visao', label: 'Visão geral', icon: 'grip', count: 3 },
    { id: 'faturas', label: 'Faturas', icon: 'file', count: 128 },
    { id: 'ledger', label: 'Ledger', icon: 'star' },
  ];
  const muitas = Array.from({ length: 18 }).map((_, i) => ({
    id: 'aba' + i,
    label: i % 4 === 0 ? 'Aba de nome bem comprido ' + i : 'Aba ' + i,
    icon: 'tag',
    count: i * 7,
  }));
  const [a, setA] = React.useState('visao');
  const [b, setB] = React.useState('aba0');
  return (
    <div className="min-h-full bg-neutral-950">
      <RouteHeader
        variant="bar"
        title="tabs"
        icon="panelRight"
        badge={<Badge tone="orange">{muitas.length + poucas.length}</Badge>}
        actions={<Button size="sm" variant="ghost" icon="search">Buscar</Button>}
        subtitle="Poucas abas em cima, muitas embaixo — teste de overflow horizontal."
      />
      <div className="p-6">
        <Tabs items={poucas} active={a} onChange={setA} right={<Badge tone="neutral">{a}</Badge>} />
        <p className="mt-3 text-[12px] text-neutral-500">Ativa: <span className="text-orange-300">{a}</span></p>
        <div className="mt-8 overflow-x-auto">
          <Tabs items={muitas} active={b} onChange={setB} />
        </div>
        <p className="mt-3 text-[12px] text-neutral-500">Ativa: <span className="text-orange-300">{b}</span></p>
      </div>
    </div>
  );
}`;

const VAZIO = `export default function App() {
  const [carregando, setCarregando] = React.useState(true);
  React.useEffect(() => {
    const t = window.setInterval(() => setCarregando((c) => !c), 3000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="min-h-full bg-neutral-950 p-6">
      <div className="mb-4 flex items-center gap-2">
        <Button size="sm" variant="outline" icon="rotate" onClick={() => setCarregando((c) => !c)}>Alternar</Button>
        <Badge tone={carregando ? 'yellow' : 'neutral'} dot>{carregando ? 'carregando' : 'vazio'}</Badge>
      </div>
      {carregando ? (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
          <SkeletonCards count={6} />
          <SkeletonCards count={1} />
        </div>
      ) : (
        <div className={'h-80 ' + tokens.radius.lg + ' ' + tokens.surface.base}>
          <EmptyState
            icon="search"
            title="Nenhum resultado pra esse filtro"
            description="Descrição longa o bastante pra encostar no limite de largura do estado vazio e testar a quebra em várias linhas seguidas."
          >
            <Button icon="plus">Criar o primeiro</Button>
            <Button variant="ghost">Limpar filtros</Button>
          </EmptyState>
        </div>
      )}
    </div>
  );
}`;

const METRICAS = `export default function App() {
  const [pct, setPct] = React.useState(50);
  const barras = [
    { nome: '0%', segs: [{ value: 0, tone: 'green', label: 'nada' }] },
    { nome: '50/50', segs: [{ value: 50, tone: 'green', label: 'pago' }, { value: 50, tone: 'neutral', label: 'resto' }] },
    { nome: '100%', segs: [{ value: 100, tone: 'orange', label: 'cheio' }] },
    { nome: '150% + negativo', segs: [{ value: 150, tone: 'yellow', label: 'estouro' }, { value: -30, tone: 'red', label: 'negativo' }] },
    { nome: 'fracionado', segs: [{ value: 0.0001, tone: 'green' }, { value: 999999, tone: 'orange' }] },
  ];
  return (
    <div className="min-h-full bg-neutral-950 p-6">
      <h2 className={'mb-4 text-[15px] font-semibold ' + tokens.text.primary}>Métricas e barras</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Pago" value="274 pts" sub="R$ 20.567,50" icon="check" tone="green" />
        <Stat label="Em aberto" value="197 pts" sub="R$ 12.417,23" icon="clock" tone="orange" />
        <Stat label="Zero" value="0" sub="—" icon="square" tone="neutral" />
        <Stat label="Rótulo enorme que deveria caber de algum jeito" value="-1.234.567.890" sub="valor absurdo pra testar overflow numérico" icon="zap" tone="yellow" />
      </div>
      <div className="mt-6 flex flex-col gap-4">
        {barras.map((b) => (
          <div key={b.nome}>
            <div className="mb-1.5 text-[12px] text-neutral-500">{b.nome}</div>
            <ProgressBar segments={b.segs} />
          </div>
        ))}
        <div>
          <div className="mb-1.5 flex items-center gap-2 text-[12px] text-neutral-500">
            controlado
            <span className="tabular-nums text-orange-300">{pct}</span>
            <Button size="sm" variant="ghost" icon="chevronLeft" square onClick={() => setPct(pct - 25)} />
            <Button size="sm" variant="ghost" icon="chevronRight" square onClick={() => setPct(pct + 25)} />
          </div>
          <ProgressBar segments={[{ value: pct, tone: 'orange' }, { value: 100 - pct, tone: 'neutral' }]} />
        </div>
      </div>
    </div>
  );
}`;

const TOAST_CONFETTI = `export default function App() {
  const [n, setN] = React.useState(0);
  const longo = 'Mensagem de toast bem longa que descreve um erro inteiro com detalhe demais e testa a largura máxima do card flutuante';
  return (
    <div className="min-h-full bg-neutral-950 p-6">
      <h2 className={'mb-4 text-[15px] font-semibold ' + tokens.text.primary}>Toast & confetti</h2>
      <div className="flex flex-wrap gap-2">
        <Button icon="check" onClick={() => toast('Salvo com sucesso')}>toast ok</Button>
        <Button variant="danger" icon="x" onClick={() => toast('Falha ao salvar', { tone: 'error' })}>toast erro</Button>
        <Button variant="secondary" icon="rotate" onClick={() => toast('Notas limpas', { action: { label: 'Desfazer', onClick: () => toast('Restaurado') }, durationMs: 8000 })}>
          com ação
        </Button>
        <Button variant="outline" onClick={() => toast(longo, { tone: 'error', durationMs: 10000 })}>mensagem longa</Button>
        <Button variant="ghost" onClick={() => toast('Some quase na hora', { durationMs: 300 })}>300ms</Button>
        <Button variant="ghost" onClick={() => { for (let i = 0; i < 8; i++) toast('Empilhado ' + (i + 1), { tone: i % 2 ? 'error' : 'ok' }); }}>
          8 de uma vez
        </Button>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button icon="star" onClick={() => { fireConfetti(); setN(n + 1); }}>confetti padrão</Button>
        <Button variant="secondary" icon="sparkles" onClick={() => fireConfetti({ count: 400 })}>400 peças</Button>
        <Button variant="outline" onClick={() => fireConfetti({ count: 30, spread: 0.15 })}>faixa estreita</Button>
        <Button variant="ghost" onClick={() => fireConfetti({ count: 0 })}>zero peças</Button>
      </div>
      <p className="mt-4 text-[12px] text-neutral-500">Disparos de confetti: <span className="tabular-nums text-orange-300">{n}</span></p>
    </div>
  );
}`;

const ICONES = `export default function App() {
  const nomes = [
    'terminal', 'plus', 'search', 'menu', 'send', 'arrowUp',
    'chevronDown', 'chevronUp', 'chevronRight', 'chevronLeft', 'check', 'x', 'square', 'play', 'pause',
    'rotate', 'message', 'pencil', 'zap', 'trash', 'sparkles', 'claude',
    'panelRight', 'circle', 'user', 'copy', 'command', 'grip', 'download', 'paperclip', 'clock', 'star', 'file', 'tag',
    'shield', 'shield-off', 'mic', 'image', 'volume', 'wrapText', 'smartphone',
    'monitor', 'tablet', 'maximize', 'minimize', 'code', 'link',
  ];
  const [size, setSize] = React.useState(20);
  const [stroke, setStroke] = React.useState(2);
  return (
    <div className="min-h-full bg-neutral-950 p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className={'text-[15px] font-semibold ' + tokens.text.primary}>Ícones</h2>
        <Badge tone="orange">{nomes.length}</Badge>
        {[12, 16, 20, 32, 64].map((s) => (
          <Button key={s} size="sm" variant={s === size ? 'primary' : 'outline'} onClick={() => setSize(s)}>{s}px</Button>
        ))}
        {[1, 2, 3].map((s) => (
          <Button key={s} size="sm" variant={s === stroke ? 'primary' : 'ghost'} onClick={() => setStroke(s)}>stroke {s}</Button>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
        {nomes.map((nome) => (
          <div key={nome} className={'flex flex-col items-center gap-2 px-1 py-3 ' + tokens.surface.base + ' ' + tokens.radius.md}>
            <Icon name={nome} size={size} stroke={stroke} className="text-orange-400" />
            <span className="w-full truncate text-center text-[10px] text-neutral-500" title={nome}>{nome}</span>
          </div>
        ))}
      </div>
    </div>
  );
}`;

const ESTRESSE = `export default function App() {
  const tones = ['neutral', 'orange', 'green', 'red', 'yellow'];
  const linhas = React.useMemo(() => Array.from({ length: 200 }).map((_, i) => ({
    id: i + 1,
    nome: 'item-' + (i + 1) + (i % 13 === 0 ? ' com um nome desproporcionalmente longo que precisa truncar em vez de empurrar a linha' : ''),
    tone: tones[i % tones.length],
    valor: (i * 37) % 101,
  })), []);
  const [busca, setBusca] = React.useState('');
  const vis = linhas.filter((l) => l.nome.includes(busca));
  return (
    <div className="flex h-full max-h-full flex-col bg-neutral-950">
      <RouteHeader
        variant="bar"
        title="estresse"
        icon="grip"
        badge={<Badge tone="orange">{vis.length}/{linhas.length}</Badge>}
        actions={<div className="w-56"><Input size="sm" icon="search" placeholder="filtrar…" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>}
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {vis.length === 0 ? (
          <EmptyState icon="search" title="Nada bateu com o filtro" description="Apague a busca pra ver as 200 linhas de novo." />
        ) : (
          <div className="flex flex-col gap-1">
            {vis.map((l) => (
              <div key={l.id} className={'flex items-center gap-3 px-3 py-2 ' + tokens.surface.base + ' ' + tokens.radius.md}>
                <span className="w-10 shrink-0 text-right font-mono text-[11px] tabular-nums text-neutral-600">{l.id}</span>
                <Icon name="circle" size={12} className="shrink-0 text-neutral-600" />
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-neutral-300">{l.nome}</span>
                <div className="w-24 shrink-0"><ProgressBar segments={[{ value: l.valor, tone: l.tone }, { value: 100 - l.valor, tone: 'neutral' }]} /></div>
                <Badge tone={l.tone}>{l.valor}</Badge>
                <Button size="sm" variant="ghost" square icon="chevronRight" title="abrir" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}`;

export const APP_TEMPLATES: AppTemplate[] = [
  { id: 'botoes', label: 'Botões', code: BOTOES },
  { id: 'badges', label: 'Badges & status', code: BADGES },
  { id: 'formulario', label: 'Formulário', code: FORMULARIO },
  { id: 'modal', label: 'Modal', code: MODAL },
  { id: 'tabs', label: 'Tabs', code: TABS },
  { id: 'vazio', label: 'Vazio & carregando', code: VAZIO },
  { id: 'metricas', label: 'Métricas', code: METRICAS },
  { id: 'toast', label: 'Toast & confetti', code: TOAST_CONFETTI },
  { id: 'icones', label: 'Ícones', code: ICONES },
  { id: 'estresse', label: 'Estresse', code: ESTRESSE },
];
