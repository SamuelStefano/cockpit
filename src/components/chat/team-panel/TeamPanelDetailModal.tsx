import { Modal } from '../../primitives/Modal';
import type { PanelDetail } from './panel-detail';

const isHttp = (s: string) => /^https?:\/\//i.test(s);

export function TeamPanelDetailModal({ detail, onClose }: { detail: PanelDetail | null; onClose: () => void }) {
  return (
    <Modal open={detail !== null} onClose={onClose} title={detail?.title}>
      {detail && (
        <div className="space-y-2 text-[15px] leading-6 text-neutral-300">
          {detail.tag && <p className="text-[13px] text-neutral-500">{detail.tag}</p>}
          {detail.lines.map((l, i) => <p key={i} className="whitespace-pre-wrap">{l}</p>)}
          {detail.link && isHttp(detail.link) && (
            <a href={detail.link} target="_blank" rel="noopener noreferrer" className="block truncate text-orange-400 underline">{detail.link}</a>
          )}
        </div>
      )}
    </Modal>
  );
}
