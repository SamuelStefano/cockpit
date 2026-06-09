import { Button, EmptyState, Badge } from '../components/primitives';

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
          <p className="mt-1 text-[13px] text-neutral-500">Primitivos do Deck — Button, EmptyState, Badge e tokens.</p>
        </header>

        <Section title="Button — variantes">
          <Row label="primary"><Button>Enviar</Button><Button icon="play">Rodar</Button><Button iconRight icon="arrowUp">Próximo</Button></Row>
          <Row label="secondary"><Button variant="secondary">Cancelar</Button><Button variant="secondary" icon="copy">Copiar</Button></Row>
          <Row label="ghost"><Button variant="ghost" icon="pencil">Editar</Button><Button variant="ghost">Ignorar</Button></Row>
          <Row label="danger"><Button variant="danger" icon="trash">Excluir</Button></Row>
        </Section>

        <Section title="Button — tamanhos & estados">
          <Row label="sm"><Button size="sm">Pequeno</Button><Button size="sm" variant="secondary" icon="plus">Novo</Button></Row>
          <Row label="md"><Button size="md">Médio</Button></Row>
          <Row label="loading"><Button loading>Salvando</Button><Button variant="secondary" loading>Carregando</Button></Row>
          <Row label="disabled"><Button disabled>Indisponível</Button><Button variant="danger" disabled>Excluir</Button></Row>
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
