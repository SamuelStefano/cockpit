import { Bit } from '../../components/bit/Bit';
import { BIT_STATES, BIT_STATE_LABEL } from '../../components/bit/bit-state';
import { BitCheerDemo } from './BitCheerDemo';
import { Section } from './Section';
import { Row } from './Row';

export function BitGallery() {
  return (
    <Section title="Bit — mascote do Deck">
      <Row label="estados">
        {BIT_STATES.map((state) => (
          <div key={state} data-bit-state={state} className="flex flex-col items-center gap-1">
            <Bit state={state} size={88} loop />
            <span className="text-[12px] text-neutral-600">{BIT_STATE_LABEL[state]}</span>
          </div>
        ))}
      </Row>
      <Row label="fim do turno (comemora duas vezes e volta ao normal)">
        <BitCheerDemo />
      </Row>
      <Row label="onde cada estado aparece">
        <ul className="space-y-1 text-[14px] text-neutral-400">
          <li>idle: respira e pisca na barra lateral</li>
          <li>thinking e working: ao lado do turno em andamento</li>
          <li>happy: ao terminar um turno</li>
          <li>sleeping: caixa offline</li>
          <li>error: conexão caiu</li>
        </ul>
      </Row>
      <Row label="saudação (hover acena, entrada com pop)">
        <div className="bit-greet bit-pop rounded-xl p-2"><Bit state="idle" size={64} /></div>
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
