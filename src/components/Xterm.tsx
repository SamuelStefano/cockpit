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

    // Só ajusta quando o container está montado e com tamanho real. Anexado/0x0
    // (aba oculta, drag de seleção, pós-dispose) deixa o renderer sem `dimensions`
    // e o xterm estoura em getMouseReportCoords no mousedrag/mouseup.
    let disposed = false;
    const safeFit = () => {
      if (disposed || !el.isConnected || !el.offsetParent || el.clientWidth < 2 || el.clientHeight < 2) return;
      try { fit.fit(); term.resize(id, xt.cols, xt.rows); } catch { /* noop */ }
    };
    const firstFit = requestAnimationFrame(safeFit);

    term.attach(
      id, xt.cols, xt.rows,
      (d) => xt.write(d),
      () => xt.write('\r\n\x1b[2m[sessão encerrada]\x1b[0m\r\n'),
      (snapshot) => { xt.reset(); xt.write(snapshot); }, // repinta sem duplicar
    );
    const dataSub = xt.onData((d) => term.input(id, d));
    xt.focus();

    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(safeFit);
    });
    ro.observe(el);

    return () => {
      disposed = true;
      cancelAnimationFrame(firstFit);
      cancelAnimationFrame(raf);
      ro.disconnect();
      dataSub.dispose();
      term.detach(id);
      xt.dispose();
    };
  }, [id, term]);

  return <div ref={ref} className="h-full w-full overflow-hidden" style={{ background: '#0a0a0a', padding: '6px 4px 4px 8px' }} />;
}
