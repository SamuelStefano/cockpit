import { Badge } from './primitives';
import { DocViewer, CopyDocAction } from './DocViewer';
import type { ContextDoc } from '../useCockpit';

// Tom por tipo de memória. memory ganha tom próprio (era o mais comum e caía em
// neutral sem querer). 5 tipos, 5 tons distintos.
export const TYPE_TONE: Record<string, 'orange' | 'green' | 'yellow' | 'red' | 'neutral'> = {
  user: 'orange',
  project: 'green',
  feedback: 'yellow',
  reference: 'neutral',
  memory: 'red',
};

export function ContextModal({ doc, type, onClose }: { doc: ContextDoc; type?: string; onClose: () => void }) {
  return (
    <DocViewer
      onClose={onClose}
      title={<span className="truncate text-[13px] font-semibold text-neutral-200">{doc.title}</span>}
      badges={type ? <Badge tone={TYPE_TONE[type] ?? 'neutral'}>{type}</Badge> : null}
      actions={<CopyDocAction text={doc.body} />}
      body={doc.body}
    />
  );
}
