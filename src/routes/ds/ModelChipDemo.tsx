import { useState } from 'react';
import type { Effort } from '../../../shared/protocol';
import { ModelPicker } from '../../components/chat/ModelPicker';
import { Section } from './Section';
import { Row } from './Row';

const MODELS = [
  { id: 'claude-opus-5-5', displayName: 'Claude Opus 5.5' },
  { id: 'claude-sonnet-5-5', displayName: 'Claude Sonnet 5.5' },
  { id: 'claude-haiku-5-5', displayName: 'Claude Haiku 5.5' },
];

export function ModelChipDemo() {
  const [model, setModel] = useState('claude-opus-5-5');
  const [effort, setEffort] = useState<Effort>('low');
  return (
    <Section title="Modelo e raciocínio">
      <Row label="composer">
        <div className="flex items-center rounded-[26px] border border-neutral-700 bg-neutral-950 px-2 py-1.5">
          <span className="px-2 text-[16px] text-neutral-600">Mensagem · / comandos e skills</span>
          <ModelPicker compact model={model} setModel={setModel} models={MODELS} onRefreshModels={() => {}} effort={effort} setEffort={setEffort} />
        </div>
      </Row>
    </Section>
  );
}
