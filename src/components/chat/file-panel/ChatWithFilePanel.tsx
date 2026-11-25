import type { ReactNode } from 'react';
import { FilePathContext } from '../../primitives/markdown/file-path-context';
import { ChatFilePanel } from './ChatFilePanel';
import { useChatFilePanel, type SessionFilesApi } from './useChatFilePanel';

interface ChatWithFilePanelProps {
  sessionId: string | undefined;
  files: SessionFilesApi | undefined;
  isMobile: boolean;
  children: ReactNode;
}

// The chat plus a read-only side panel for the files its messages mention.
export function ChatWithFilePanel({ sessionId, files, isMobile, children }: ChatWithFilePanelProps) {
  const p = useChatFilePanel(sessionId, files);
  return (
    <FilePathContext.Provider value={p.opener}>
      <div className="flex h-full min-h-0 min-w-0">
        <div className="h-full min-w-0 flex-1">{children}</div>
        {p.file && <ChatFilePanel path={p.file.path} line={p.file.line} openKey={`${p.file.path}#${p.file.seq}`} data={p.data} onClose={p.close} fullScreen={isMobile} />}
      </div>
    </FilePathContext.Provider>
  );
}
