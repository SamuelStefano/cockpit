import { Badge } from '../../components/primitives';
import { DocViewer, DocAction, CopyDocAction } from '../../components/DocViewer';
import { download } from '../../lib/export';
import type { SkillDoc } from '../../useCockpit';

export function SkillModal({ doc, onClose }: { doc: SkillDoc; onClose: () => void }) {
  return (
    <DocViewer
      onClose={onClose}
      title={<span className="truncate font-mono text-[13px] font-semibold lowercase text-neutral-200">{doc.name}</span>}
      badges={<Badge tone="neutral">skill</Badge>}
      actions={
        <>
          <CopyDocAction text={doc.body} />
          <DocAction label=".md" icon="download" onClick={() => download(`${doc.id}.md`, 'text/markdown', doc.body)} />
          <DocAction label=".json" icon="download" onClick={() => download(`${doc.id}.json`, 'application/json', JSON.stringify({ id: doc.id, name: doc.name, body: doc.body }, null, 2))} />
        </>
      }
      body={doc.body}
    />
  );
}
