import { Bit } from '../../components/bit/Bit';
import { BIT_STATES, BIT_STATE_LABEL } from '../../components/bit/bit-state';
import { Section } from './Section';
import { Row } from './Row';

export function BitGallery() {
  return (
    <Section title="Bit — mascote do Deck">
      <Row label="estados">
        {BIT_STATES.map((state) => (
          <div key={state} data-bit-state={state} className="flex flex-col items-center gap-1">
            <Bit state={state} size={88} />
            <span className="text-[10.5px] text-neutral-600">{BIT_STATE_LABEL[state]}</span>
          </div>
        ))}
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
