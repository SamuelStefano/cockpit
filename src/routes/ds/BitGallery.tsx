import { Bit } from '../../components/bit/Bit';
import { BIT_STATES, BIT_STATE_LABEL } from '../../components/bit/bit-state';
import { RailChats } from '../../components/chrome/sidebar/RailChats';
import type { Session } from '../../data/types';
import { Section } from './Section';
import { Row } from './Row';

const demo = (id: string, title: string, mtime: number): Session => ({ id, title, relative: '', snippet: '', mtime, hasTerminal: false, active: false });
const RAIL_DEMO = [demo('r1', 'Corrigir login', 5), demo('r2', 'Migrar banco', 3), demo('r3', 'Ajustar sidebar', 4), demo('r4', 'Deploy do relay', 2), demo('r5', 'Escrever testes', 1)];

export function BitGallery() {
  return (
    <Section title="Bit — mascote do Deck">
      <Row label="estados">
        {BIT_STATES.map((state) => (
          <div key={state} data-bit-state={state} className="flex flex-col items-center gap-1">
            <Bit state={state} size={88} />
            <span className="text-[12px] text-neutral-600">{BIT_STATE_LABEL[state]}</span>
          </div>
        ))}
      </Row>
      <Row label="onde cada estado aparece">
        <ul className="text-[13px] text-neutral-400">
          <li>idle: piscar e respirar leve no cabeçalho da sidebar</li>
          <li>thinking / working / talking: indicador do turno em andamento</li>
          <li>happy: pulinho ao terminar um turno (cabeçalho e bolha)</li>
          <li>sleeping: caixa offline · error: falha de conexão</li>
          <li>wave / connecting: telas de login e pareamento</li>
        </ul>
      </Row>
      <Row label="saudação (hover acena, entrada com pop)">
        <div className="bit-greet bit-pop rounded-xl p-2"><Bit state="idle" size={64} /></div>
      </Row>
      <Row label="sidebar recolhida: conversas (a 2ª trabalhando)">
        <div className="flex w-14 flex-col items-center rounded-xl border border-neutral-800 bg-neutral-950 py-2">
          <RailChats sessions={RAIL_DEMO} running={new Set(['r2'])} activeId="r1" onSelect={() => {}} />
        </div>
      </Row>
      <Row label="tamanhos">
        {[20, 28, 40, 64, 120].map((s) => <Bit key={s} size={s} />)}
      </Row>
      <Row label="parado (bolhas antigas do chat)">
        <Bit size={28} still />
        <Bit size={64} still />
      </Row>
    </Section>
  );
}
