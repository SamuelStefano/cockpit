import { Modal } from '../Modal';
import type { PanelItem } from './parse-panel';
import { useSessionRef } from '../markdown/session-link-context';

export function PanelItemModal({ item, onClose }: { item: PanelItem | null; onClose: () => void }) {
  const session = useSessionRef(item?.session);
  return (
    <Modal open={item !== null} onClose={onClose} title={item?.title}>
      {item && (
        <div className="space-y-3 text-[15px] leading-6 text-neutral-300">
          {item.tag && <p className="text-[13px] text-neutral-500">{item.tag}</p>}
          {item.detail && <p className="whitespace-pre-wrap">{item.detail}</p>}
          {session && (
            <button type="button" onClick={() => { onClose(); session.open(); }} className="block cursor-pointer text-orange-400 underline">
              Open session {item?.session}
            </button>
          )}
          {item.link && (
            <a href={item.link} target="_blank" rel="noopener noreferrer" className="block truncate text-orange-400 underline">
              {item.link}
            </a>
          )}
        </div>
      )}
    </Modal>
  );
}
