import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import type { TermApi } from '../useCockpit';

// Monta um xterm.js real e liga no PTY/tmux do backend via WS.
// Anexa no mount (com replay de scrollback), desanexa no unmount (sessão tmux
// segue viva). Trocar de aba remonta → reattach + redraw do tmux.
export function XtermView({ id, term }: { id: string; term: TermApi }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const xt = new XTerm({
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      fontSize: 12.5,
      lineHeight: 1.3,
      cursorBlink: true,
      scrollback: 5000,
      theme: {
        background: '#0a0a0a',
        foreground: '#e5e5e5',
        cursor: '#f97316',
        cursorAccent: '#0a0a0a',
        selectionBackground: '#3f3f46',
        black: '#171717', red: '#ef4444', green: '#22c55e', yellow: '#eab308',
        blue: '#3b82f6', magenta: '#a855f7', cyan: '#06b6d4', white: '#d4d4d4',
      },
    });
    const fit = new FitAddon();
    xt.loadAddon(fit);
    xt.open(el);
    try { fit.fit(); } catch { /* container pode estar 0x0 momentaneamente */ }

    term.attach(id, xt.cols, xt.rows, (d) => xt.write(d), () => xt.write('\r\n\x1b[2m[sessão encerrada]\x1b[0m\r\n'));
    const dataSub = xt.onData((d) => term.input(id, d));
    xt.focus();

    const ro = new ResizeObserver(() => {
      try { fit.fit(); term.resize(id, xt.cols, xt.rows); } catch { /* noop */ }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      dataSub.dispose();
      term.detach(id);
      xt.dispose();
    };
  }, [id, term]);

  return <div ref={ref} className="h-full w-full overflow-hidden" style={{ background: '#0a0a0a', padding: '6px 4px 4px 8px' }} />;
}
