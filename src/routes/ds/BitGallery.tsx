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
