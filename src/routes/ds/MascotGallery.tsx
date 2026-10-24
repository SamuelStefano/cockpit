import { Mascot } from '../../components/team/Mascot';
import { MascotStatusLine } from '../../components/team/MascotStatusLine';
import { PrimaryStar } from '../../components/team/PrimaryStar';
import { MASCOT_STATES, MASCOT_STATE_LABEL } from '../../components/team/mascot-state';
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
          {MASCOT_STATES.map((state) => (
            <div key={state} className="flex flex-col items-center gap-1">
              <Mascot mascot={{ shape, color: MASCOT_COLORS[i] }} state={state} size={44} />
              <span className="text-[10.5px] text-neutral-600">{MASCOT_STATE_LABEL[state]}</span>
            </div>
          ))}
        </Row>
      ))}
      <Row label="principal">
        <div className="relative">
          <Mascot mascot={{ shape: 'blob', color: MASCOT_COLORS[0] }} size={56} />
          <span className="absolute -bottom-0.5 -right-0.5"><PrimaryStar /></span>
        </div>
      </Row>
      <Row label="status vivo">
        <MascotStatusLine active startedAt={Date.now()} />
      </Row>
    </Section>
  );
}
