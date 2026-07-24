import { useState } from 'react';
import { Button, EmptyState, Badge, Input, RouteHeader, toast, Stat, ProgressBar, Tabs, Modal, LivePreview, fireConfetti } from '../components/primitives';
import { ThemePlayground } from './ds/ThemePlayground';

const DEMO_PREVIEW = `import { useState } from 'react';

export default function Contador() {
  const [n, setN] = useState(0);
  return (
    <div className="flex flex-col items-center gap-3 p-4">
      <div className="text-4xl font-bold text-orange-500">{n}</div>
      <button onClick={() => setN(n + 1)}
        className="rounded-lg bg-orange-500 px-4 py-2 font-medium text-white hover:bg-orange-600">
        somar +1
      </button>
    </div>
  );
}`;

const DEMO_PREVIEW_NATIVE = `import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

export default function App() {
  const [n, setN] = useState(0);
  return (
    <View style={s.wrap}>
      <Text style={s.num}>{n}</Text>
      <Pressable style={s.btn} onPress={() => setN(n + 1)}>
        <Text style={s.btnTxt}>somar +1</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: '#0c0c0c' },
  num: { fontSize: 48, fontWeight: '700', color: '#f97316' },
  btn: { backgroundColor: '#f97316', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  btnTxt: { color: '#fff', fontWeight: '600' },
});`;

const DEMO_PREVIEW_SVG = `<svg width="180" height="180" viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg">
  <rect x="30" y="30" width="120" height="120" rx="24" fill="#f97316">
    <animate attributeName="rx" values="24;60;24" dur="2s" repeatCount="indefinite" />
  </rect>
  <circle cx="90" cy="90" r="26" fill="#0c0c0c" />
</svg>`;

const DEMO_PREVIEW_TEST = `function fib(n) {
  return n < 2 ? n : fib(n - 1) + fib(n - 2);
}

test('fib base', () => {
  expect(fib(0)).toBe(0);
  expect(fib(1)).toBe(1);
});

test('fib(10) = 55', () => {
  expect(fib(10)).toBe(55);
});

test('isso falha de propósito', () => {
  expect(fib(5)).toBe(999);
});`;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-neutral-800 pb-8">
      <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-neutral-500">{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 py-2">
      <span className="w-28 shrink-0 text-[12px] text-neutral-600">{label}</span>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

export function DesignSystem() {
  const [tab, setTab] = useState<'arvore' | 'faturas' | 'ledger'>('arvore');
  const [modalOpen, setModalOpen] = useState(false);
  return (
    <div className="scroll-thin h-full overflow-y-auto bg-neutral-950 px-8 py-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header>
          <h2 className="text-[20px] font-semibold text-neutral-100">Design System</h2>
          <p className="mt-1 text-[13px] text-neutral-500">Primitivos do Deck — Button, Input, Badge, Stat, ProgressBar, Tabs, Toast, EmptyState e tokens.</p>
        </header>

        <Section title="Button — variantes">
          <Row label="primary"><Button>Enviar</Button><Button icon="play">Rodar</Button><Button iconRight icon="arrowUp">Próximo</Button></Row>
          <Row label="secondary"><Button variant="secondary">Cancelar</Button><Button variant="secondary" icon="copy">Copiar</Button></Row>
          <Row label="outline"><Button variant="outline" icon="plus">Nova sessão</Button><Button variant="outline">Conectar</Button></Row>
          <Row label="ghost"><Button variant="ghost" icon="pencil">Editar</Button><Button variant="ghost">Ignorar</Button></Row>
          <Row label="danger"><Button variant="danger" icon="trash">Excluir</Button></Row>
        </Section>

        <Section title="Button — tamanhos & estados">
          <Row label="sm"><Button size="sm">Pequeno</Button><Button size="sm" variant="secondary" icon="plus">Novo</Button></Row>
          <Row label="md"><Button size="md">Médio</Button></Row>
          <Row label="square">
            <Button square icon="plus" title="Novo" />
            <Button variant="secondary" square icon="copy" title="Copiar" />
            <Button variant="outline" square icon="terminal" title="Terminal" />
            <Button variant="ghost" square icon="x" title="Fechar" />
            <Button variant="ghost" size="sm" square icon="x" title="Fechar (sm)" />
          </Row>
          <Row label="loading"><Button loading>Salvando</Button><Button variant="secondary" loading>Carregando</Button></Row>
          <Row label="disabled"><Button disabled>Indisponível</Button><Button variant="danger" disabled>Excluir</Button></Row>
        </Section>

        <Section title="Input">
          <Row label="md"><Input placeholder="voce@exemplo.com" /></Row>
          <Row label="sm"><Input size="sm" placeholder="NOME_DO_TOKEN" /></Row>
          <Row label="error"><Input error defaultValue="http://errado" /></Row>
          <Row label="mono"><Input mono placeholder="wss://deck.exemplo.com" /></Row>
          <Row label="password"><Input type="password" placeholder="••••••••" /></Row>
          <Row label="icon"><Input icon="search" placeholder="buscar…" /></Row>
          <Row label="suffix"><Input icon="search" mono size="sm" placeholder="buscar nó…" suffix={<span className="font-mono text-[10.5px] text-orange-300">58</span>} /></Row>
        </Section>

        <Section title="Badge">
          <Row label="tones">
            <Badge>neutral</Badge>
            <Badge tone="orange">orange</Badge>
            <Badge tone="green" dot>online</Badge>
            <Badge tone="red" dot>erro</Badge>
            <Badge tone="yellow">aviso</Badge>
          </Row>
        </Section>

        <Section title="Toast">
          <Row label="ok"><Button onClick={() => toast('Notas salvas')}>Disparar ok</Button></Row>
          <Row label="error"><Button variant="danger" onClick={() => toast('Falha ao salvar', { tone: 'error' })}>Disparar erro</Button></Row>
          <Row label="ação">
            <Button variant="secondary" onClick={() => toast('Notas limpas', { action: { label: 'Desfazer', onClick: () => toast('Restaurado') }, durationMs: 8000 })}>
              Com desfazer
            </Button>
          </Row>
        </Section>

        <Section title="RouteHeader">
          <Row label="bar">
            <div className="w-full overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950">
              <RouteHeader
                variant="bar"
                title="contextos"
                badge={<Badge tone="neutral">42</Badge>}
                actions={<Button variant="ghost" size="sm" icon="search">Buscar</Button>}
              >
                <div className="flex gap-1.5">
                  <Badge tone="orange">todos</Badge>
                  <Badge tone="neutral">user</Badge>
                  <Badge tone="neutral">project</Badge>
                </div>
              </RouteHeader>
            </div>
          </Row>
          <Row label="page">
            <div className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-4">
              <RouteHeader
                variant="page"
                title="Crons"
                icon="clock"
                subtitle={
                  <>
                    <span>Prompts agendados — disparam turnos autônomos.</span>
                    <span className="tabular-nums text-neutral-600">3 ativos de 5</span>
                  </>
                }
                actions={<Button size="sm" icon="plus">Novo</Button>}
              />
            </div>
          </Row>
        </Section>

        <Section title="Stat">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Pago" value="274 pts" sub="R$ 20.567,50" icon="check" tone="green" />
            <Stat label="Em aberto" value="197 pts" sub="R$ 12.417,23" icon="clock" tone="orange" />
            <Stat label="A fazer" value="20 pts" sub="—" icon="square" tone="neutral" />
          </div>
        </Section>

        <Section title="ProgressBar">
          <Row label="segmentos">
            <div className="w-full">
              <ProgressBar segments={[
                { value: 274, tone: 'green', label: 'pago' },
                { value: 197, tone: 'orange', label: 'aberto' },
                { value: 20, tone: 'neutral', label: 'a fazer' },
              ]} />
            </div>
          </Row>
        </Section>

        <Section title="Tabs">
          <Tabs items={[
            { id: 'arvore', label: 'Árvore', icon: 'grip', count: 11 },
            { id: 'faturas', label: 'Faturas', icon: 'file', count: 13 },
            { id: 'ledger', label: 'Ledger', icon: 'star' },
          ]} active={tab} onChange={setTab} />
          <p className="mt-3 text-[12px] text-neutral-500">Aba ativa: <span className="text-orange-300">{tab}</span></p>
        </Section>

        <Section title="Modal">
          <Row label="dialog">
            <Button variant="secondary" icon="grip" onClick={() => setModalOpen(true)}>Abrir modal</Button>
            <Modal
              open={modalOpen}
              onClose={() => setModalOpen(false)}
              title="Editar task"
              icon="pencil"
              footer={
                <>
                  <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
                  <Button onClick={() => setModalOpen(false)}>Salvar</Button>
                </>
              }
            >
              <p className="text-[13px] text-neutral-400">Overlay com backdrop, fecha no clique-fora e no Esc. Corpo rola; footer opcional pra ações.</p>
            </Modal>
          </Row>
        </Section>

        <Section title="EmptyState">
          <div className="h-64 rounded-xl border border-neutral-800 bg-neutral-900/40">
            <EmptyState
              icon="search"
              title="Nenhuma sessão encontrada"
              description="Ajuste os filtros ou comece uma nova conversa com o agente."
            >
              <Button icon="plus">Nova sessão</Button>
            </EmptyState>
          </div>
        </Section>

        <Section title="Micro-interações">
          <p className="mb-3 text-[12px] text-neutral-600">
            <code className="text-orange-300">ripple</code> no clique do Button, <code className="text-orange-300">confetti</code> via
            barramento global (dispara em transição de suíte de testes vermelho→verde) e o anel de foco{' '}
            <code className="text-orange-300">pulse-ring</code>. Tudo respeita <code className="text-orange-300">prefers-reduced-motion</code>.
          </p>
          <Row label="ripple"><Button ripple>Com ripple</Button><Button ripple variant="secondary" icon="copy">Copiar</Button></Row>
          <Row label="confetti"><Button icon="star" onClick={() => fireConfetti()}>Soltar confetti</Button></Row>
          <Row label="pulse-ring">
            <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-full bg-orange-500/15 text-orange-300">
              <span className="pulse-ring absolute inset-0 ring-2 ring-orange-500/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
            </span>
            <span className="text-[12px] text-neutral-600">indicador ao vivo</span>
          </Row>
        </Section>

        <Section title="Theme playground — acento ao vivo">
          <p className="mb-3 text-[12px] text-neutral-600">
            Ajuste matiz, saturação, raio e densidade e veja os tokens (<code className="text-orange-300">--accent</code>,{' '}
            <code className="text-orange-300">--ring</code>) mudarem no app inteiro em tempo real. Sai da rota → restaura o tema.
          </p>
          <ThemePlayground />
        </Section>

        <Section title="Studio — código editável ao vivo">
          <p className="mb-3 text-[12px] text-neutral-600">
            Bloco <code className="text-orange-300">```preview</code> (React/TSX) ou{' '}
            <code className="text-orange-300">```preview-html</code> vira tela viva num iframe sandbox. Abra a aba{' '}
            <span className="text-orange-300">código</span> e <strong className="text-neutral-400">digite</strong> — a tela
            re-renderiza ao vivo. Barra: switcher de <span className="text-orange-300">viewport</span> (desktop/tablet/mobile),{' '}
            <span className="text-orange-300">console</span> capturado do sandbox, <span className="text-orange-300">tela cheia</span>{' '}
            (studio split editor↔preview) e copiar/baixar o código.
          </p>
          <LivePreview lang="preview" code={DEMO_PREVIEW} />
        </Section>

        <Section title="Studio nativo — iPhone editável (react-native-web)">
          <p className="mb-3 text-[12px] text-neutral-600">
            Bloco <code className="text-orange-300">```preview-native</code> roda react-native de verdade
            (View, Text, Pressable, StyleSheet) via react-native-web numa moldura de iPhone — sem macOS. Também editável ao
            vivo: digite na aba código e veja o app mudar na tela do telefone.
          </p>
          <LivePreview lang="preview-native" code={DEMO_PREVIEW_NATIVE} />
        </Section>

        <Section title="Studio SVG — vetor animado editável">
          <p className="mb-3 text-[12px] text-neutral-600">
            Bloco <code className="text-orange-300">```preview-svg</code> renderiza SVG cru (com <code className="text-orange-300">&lt;animate&gt;</code>,
            SMIL ou CSS) centralizado sobre um xadrez de transparência. Edite os atributos e veja a animação mudar na hora.
          </p>
          <LivePreview lang="preview-svg" code={DEMO_PREVIEW_SVG} />
        </Section>

        <Section title="Juiz de código — testes verde/vermelho no sandbox">
          <p className="mb-3 text-[12px] text-neutral-600">
            Bloco <code className="text-orange-300">```preview-test</code> roda <code className="text-orange-300">test()</code> +{' '}
            <code className="text-orange-300">expect()</code> (globais) dentro do sandbox e mostra cada asserção passando ou falhando,
            com resumo <span className="text-neutral-400">N/N</span>. O terceiro test abaixo falha de propósito.
          </p>
          <LivePreview lang="preview-test" code={DEMO_PREVIEW_TEST} />
        </Section>

        <Section title="Playground — bancada completa em /play">
          <p className="text-[12px] text-neutral-600">
            Uma página inteira (<code className="text-orange-300">/play</code>) com editor ↔ preview lado a lado, seletor de linguagem
            (React, HTML, iPhone, SVG, testes), templates prontos, switcher de dispositivo e console — construída com estes mesmos primitivos.
          </p>
          <a href="/play" className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-orange-500/15 px-3 py-1.5 text-[12px] font-medium text-orange-300 transition hover:bg-orange-500/25">
            abrir playground →
          </a>
        </Section>
      </div>
    </div>
  );
}
