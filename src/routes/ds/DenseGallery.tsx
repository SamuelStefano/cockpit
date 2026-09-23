import { useState } from 'react';
import { Badge, Button, ButtonGroup, Checkbox, Drawer, Input, ProgressBar, Segmented, Stat } from '../../components/primitives';
import { Section } from './Section';
import { Row } from './Row';

// Pieces for dense workspaces (/pontos): tables, navigators, KPI strips.
export function DenseGallery() {
  const [checked, setChecked] = useState(true);
  const [seg, setSeg] = useState<'all' | 'open' | 'paid'>('all');
  const [drawer, setDrawer] = useState(false);
  return (
    <Section title="Denso — tabelas, navegador, KPI">
      <Row label="Checkbox">
        <Checkbox checked={checked} onChange={setChecked} label="Selecionar task" />
        <Checkbox checked={false} indeterminate onChange={() => {}} label="Parcial" />
        <Checkbox checked={false} onChange={() => {}} label="Desligado" disabled />
      </Row>
      <Row label="Segmented">
        <Segmented label="Status" value={seg} onChange={setSeg} items={[{ id: 'all', label: 'todos' }, { id: 'open', label: 'aberto' }, { id: 'paid', label: 'pago' }]} />
      </Row>
      <Row label="ButtonGroup">
        <ButtonGroup label="agente">
          <Button size="sm" icon="zap">criar tudo</Button>
          <Button variant="ghost" size="sm">só esta delivery</Button>
        </ButtonGroup>
      </Row>
      <Row label="Button xs">
        <Button variant="outline" size="xs" icon="zap">criar só esta</Button>
        <Button variant="ghost" size="xs" square icon="x" title="Remover" />
      </Row>
      <Row label="Input bare"><div className="w-64 rounded-md border border-neutral-800"><Input size="sm" bare placeholder="nova task" /></div></Row>
      <Row label="Badge href">
        <Badge href="https://github.com/devfellowship/dfl-lesson-studio/pull/577" className="font-mono">LS#577</Badge>
        <Badge className="font-mono">~25 PRs</Badge>
      </Row>
      <Row label="ProgressBar xs">
        <div className="w-32"><ProgressBar size="xs" segments={[{ value: 36, tone: 'orange' }, { value: 64, tone: 'track' }]} /></div>
        <div className="w-32"><ProgressBar size="xs" segments={[{ value: 100, tone: 'yellow' }]} /></div>
      </Row>
      <Row label="Stat compact">
        <div className="flex gap-6">
          <Stat compact label="faturado set/26" tone="green" value="R$ 0" />
          <Stat compact label="cabe agora" tone="orange" value="R$ 4.000" />
          <Stat compact label="em espera" tone="yellow" value="R$ 7.625" />
        </div>
      </Row>
      <Row label="Drawer">
        <Button variant="secondary" size="sm" icon="layers" onClick={() => setDrawer(true)}>Abrir drawer</Button>
        <Drawer open={drawer} onClose={() => setDrawer(false)} title="Épicos">
          <p className="p-3 text-[12.5px] text-neutral-400">Painel lateral no celular: o que é coluna fixa no desktop vira gaveta.</p>
        </Drawer>
      </Row>
    </Section>
  );
}
