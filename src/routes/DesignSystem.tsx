import { Button, EmptyState, Badge, Input, toast } from '../components/primitives';

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
  return (
    <div className="scroll-thin h-full overflow-y-auto bg-neutral-950 px-8 py-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header>
          <h2 className="text-[20px] font-semibold text-neutral-100">Design System</h2>
          <p className="mt-1 text-[13px] text-neutral-500">Primitivos do Deck — Button, Input, Badge, Toast, EmptyState e tokens.</p>
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
      </div>
    </div>
  );
}
