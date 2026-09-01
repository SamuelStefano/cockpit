import { useState } from 'react';
import { Button, EmptyState, Badge, RouteHeader, Stat, ProgressBar, Tabs, Modal, fireConfetti } from '../../components/primitives';
import { Section } from './Section';
import { Row } from './Row';

export function CompositesGallery() {
  const [tab, setTab] = useState<'arvore' | 'faturas' | 'ledger'>('arvore');
  const [modalOpen, setModalOpen] = useState(false);
  return (
    <>
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
    </>
  );
}
