import { useEffect, useRef, type RefObject } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import type { TermApi } from '../useCockpit';
import { useTerminalClipboard, type TerminalClipboardApi } from './useTerminalClipboard';

interface Props {
  id: string;
  term: TermApi;
  watch?: string; // session uuid: the pane follows that transcript live
  autoFocus?: boolean;
  focusKey?: number; // bump to pull keyboard focus into this terminal
  fontSize?: number;
  clipboardRef?: RefObject<TerminalClipboardApi | null>; // lets a toolbar copy/paste for this terminal
}

// Monta um xterm.js real e liga no PTY/tmux do backend via WS.
// Anexa no mount (com replay de scrollback), desanexa no unmount (sessão tmux
// segue viva). Trocar de aba remonta → reattach + redraw do tmux.
export function XtermView({ id, term, watch, autoFocus = true, focusKey, fontSize = 12.5, clipboardRef }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const xtRef = useRef<XTerm | null>(null);
  const clipboard = useTerminalClipboard();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const xt = new XTerm({
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      fontSize,
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
    xtRef.current = xt;

    // Só ajusta quando o container está montado e com tamanho real. Anexado/0x0
    // (aba oculta, drag de seleção, pós-dispose) deixa o renderer sem `dimensions`
    // e o xterm estoura em getMouseReportCoords no mousedrag/mouseup.
    let disposed = false;
    const canFit = () => !disposed && el.isConnected && !!el.offsetParent && el.clientWidth >= 2 && el.clientHeight >= 2;
    const safeFit = () => {
      if (!canFit()) return;
      try { fit.fit(); term.resize(id, xt.cols, xt.rows); } catch { /* noop */ }
    };
    // Fit before attach so term-open carries the real size, not xterm's 80x24
    // default: tmux sizes its client from the open and a queued resize is skipped.
    if (canFit()) { try { fit.fit(); } catch { /* noop */ } }
    const firstFit = requestAnimationFrame(safeFit);
    const unbindClipboard = clipboard.bind(xt, el);
    if (clipboardRef) clipboardRef.current = { copy: clipboard.copy, paste: clipboard.paste };

    term.attach(
      id, xt.cols, xt.rows,
      (d) => xt.write(d),
      () => xt.write('\r\n\x1b[2m[sessão encerrada]\x1b[0m\r\n'),
      (snapshot) => { xt.reset(); xt.write(snapshot); }, // repinta sem duplicar
      watch,
    );
    const dataSub = xt.onData((d) => term.input(id, d));
    if (autoFocus) xt.focus();

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
      unbindClipboard();
      if (clipboardRef) clipboardRef.current = null;
      term.detach(id);
      xtRef.current = null;
      xt.dispose();
    };
    // fontSize/autoFocus only matter at mount; changing them must not reattach.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, term, watch]);

  useEffect(() => {
    if (!focusKey) return;
    // Next frame: the click that asked for focus is still being dispatched.
    const raf = requestAnimationFrame(() => xtRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [focusKey]);

  return (
    // Padding sits on this wrapper, never on the element xterm opens in:
    // FitAddon sizes rows/cols from that element's computed width/height,
    // which under the global border-box includes padding, so the last row
    // landed half under the bottom edge. letter-spacing: body's -0.011em was
    // inherited by xterm's glyph-width measurer, every cell got +0.18px of
    // spacing, and the last ~2 columns of a full line were clipped.
    <div className="h-full w-full overflow-hidden" style={{ background: '#0a0a0a', padding: '6px 4px 4px 8px', letterSpacing: 'normal' }}>
      <div ref={ref} data-testid="xterm-host" className="h-full w-full" />
    </div>
  );
}
