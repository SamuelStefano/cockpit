import { useState } from 'react';
import { Icon, tokens } from '../primitives';
import type { ToolCall } from '../../../shared/protocol';
import { useMcpApp } from './useMcpApp';

// Renderiza a UI que o próprio servidor MCP entregou (SEP-1865). O sandbox NÃO
// inclui allow-same-origin: origem opaca é o que impede o app de ler o
// localStorage do Deck (sessão Supabase) e de falar com nossa API como usuário.
export function McpAppFrame({ tool }: { tool: ToolCall }) {
  const { ref, srcDoc, height } = useMcpApp(tool);
  const [open, setOpen] = useState(true);
  if (!tool.app) return null;

  return (
    <div className="px-3 pb-2">
      <div className="overflow-hidden rounded-md border border-neutral-800 bg-[#0c0c0c]">
        <div className="flex items-center gap-1.5 border-b border-neutral-800 px-2.5 py-1.5">
          <Icon name="sparkles" size={12} className="shrink-0 text-orange-400" />
          <span className="truncate font-mono text-[11px] text-neutral-500">{tool.app.uri}</span>
          <button
            onClick={() => setOpen((o) => !o)}
            title={open ? 'Ocultar o app' : 'Mostrar o app'}
            className={`ml-auto shrink-0 rounded text-neutral-600 transition hover:text-neutral-300 ${tokens.focusRing}`}
          >
            <Icon name="chevronDown" size={13} style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
          </button>
        </div>
        {open && (
          <iframe
            ref={ref}
            title={`MCP App ${tool.app.uri}`}
            sandbox="allow-scripts"
            srcDoc={srcDoc}
            className="block w-full border-0"
            style={{ height }}
          />
        )}
      </div>
    </div>
  );
}
