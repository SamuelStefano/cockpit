import { Mascot } from '../../components/team/Mascot';
import { LivingPhrase } from '../../components/team/LivingPhrase';
import { PrimaryStar } from '../../components/team/PrimaryStar';
import { BOT_STATES, BOT_STATE_LABEL } from '../../components/team/botState';
import { MASCOT_COLORS } from '../../components/team/mascot-shapes';
import type { MascotShape } from '../../../shared/protocol';
import { Section } from './Section';
import { Row } from './Row';

const SHAPES: MascotShape[] = ['drop', 'blob', 'tri', 'bean'];

export function MascotGallery() {
  return (
    <Section title="Mascote da Equipe">
      {SHAPES.map((shape, i) => (
        <Row key={shape} label={shape}>
          {BOT_STATES.map((state) => (
            <div key={state} className="flex flex-col items-center gap-1">
              <Mascot mascot={{ shape, color: MASCOT_COLORS[i] }} state={state} size={44} />
              <span className="text-[12px] text-neutral-600">{BOT_STATE_LABEL[state]}</span>
            </div>
          ))}
        </Row>
      ))}
      <Row label="32 px (barra)">
        {BOT_STATES.map((state) => (
          <div key={state} data-state={state} className="flex flex-col items-center gap-1">
            <Mascot mascot={{ shape: 'blob', color: MASCOT_COLORS[0] }} state={state} size={32} />
            <span className="text-[12px] text-neutral-600">{BOT_STATE_LABEL[state]}</span>
          </div>
        ))}
      </Row>
      <Row label="principal">
        <div className="relative">
          <Mascot mascot={{ shape: 'blob', color: MASCOT_COLORS[0] }} size={56} />
          <span className="absolute -bottom-0.5 -right-0.5"><PrimaryStar /></span>
        </div>
      </Row>
      <Row label="status vivo">
        <LivingPhrase active startedAt={Date.now()} />
      </Row>
    </Section>
  );
}
