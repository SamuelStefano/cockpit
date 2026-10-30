import { useRef, useState } from 'react';
import { Button } from '../../components/primitives';
import { BitStageLayer } from '../../components/bit/play/BitStageLayer';
import { BitPlayground } from '../../components/bit/play/BitPlayground';
import { useSkitStage, STAGE_BIT_SIZE } from '../../components/bit/play/useSkitStage';
import { SKIT_IDS, SKIT_LABEL } from '../../components/bit/play/skits';
import { BitFishing } from '../../components/bit/fishing/BitFishing';
import { Section } from './Section';
import { Row } from './Row';

const DEMO_TEXT = [
  'Pronto: o relay agora reconecta sozinho quando a caixa volta do sleep.',
  'Também ajustei o timeout do handshake e escrevi testes para os dois caminhos.',
  'Quer que eu abra a PR agora ou prefere revisar o diff antes?',
];

export function BitPlayGallery() {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLDivElement | null>(null);
  const stage = useSkitStage(layerRef, textRef);
  const [fishing, setFishing] = useState(false);
  return (
    <Section title="Bit brincalhão">
      <Row label="esquetes">
        {SKIT_IDS.map((id) => (
          <Button key={id} size="sm" variant="secondary" data-skit={id} disabled={stage.playing} onClick={() => stage.play(id)}>{SKIT_LABEL[id]}</Button>
        ))}
        <Button size="sm" variant="ghost" data-skit="hurry" disabled={!stage.playing} onClick={stage.hurry}>Flagrar (sai correndo)</Button>
      </Row>
      <div data-bit-skit-stage className="relative h-[380px] overflow-hidden rounded-2xl border border-neutral-800 bg-[var(--bg-deep)]">
        <div ref={textRef} className="flex flex-col gap-5 px-14 pt-24 text-[15px] leading-relaxed text-neutral-200">
          {DEMO_TEXT.map((t) => <p key={t}>{t}</p>)}
        </div>
        <BitStageLayer layerRef={layerRef} actorRef={stage.actorRef} letterRef={stage.letterRef} look={stage.look} size={STAGE_BIT_SIZE} />
        <div className="absolute inset-x-0 bottom-0 h-0 border-t border-neutral-700" />
      </div>
      <Row label="pesca (turno rodando)">
        <Button size="sm" variant="secondary" data-fish="toggle" onClick={() => setFishing((v) => !v)}>{fishing ? 'Terminar turno (recolhe a vara)' : 'Simular turno (Bit pesca)'}</Button>
        <span className="text-[12px] text-neutral-500">Clique no Bit para pescar na hora</span>
      </Row>
      <div data-bit-fishing-stage className="relative h-[220px] overflow-hidden rounded-2xl border border-neutral-800 bg-[var(--bg-deep)]">
        <div className="mx-auto mt-6 max-w-[360px] space-y-3 px-4 text-[15px] leading-relaxed text-neutral-300">
          <p>Rodando os testes e conferindo o diff antes de abrir a PR.</p>
          <p>Enquanto isso o Bit pesca na margem da conversa.</p>
        </div>
        <BitFishing running={fishing} forceRoom />
      </div>
      <Row label="conversa nova (passe o mouse perto)">
        <div data-bit-playground className="flex w-full justify-center rounded-2xl border border-neutral-800 bg-[var(--bg-deep)] py-4"><BitPlayground /></div>
      </Row>
    </Section>
  );
}
