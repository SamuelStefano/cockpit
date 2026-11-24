import { useState } from 'react';
import type { CanvasCard, SessionPeek } from '../../../../shared/canvas';
import { baseName, type ActivitySummary } from '../activity';

const STATUS_LABEL = { todo: 'To do', doing: 'Doing', review: 'In review', done: 'Done' } as const;
const MAX_PROMPT = 4000;

// The prompt is plain text, one line until clicked.
function CardLine({ card }: { card: CanvasCard }) {
  const [open, setOpen] = useState(false);
  const prompt = card.prompt?.trim();
  return (
    <div className="card">
      <p><b>{STATUS_LABEL[card.status] ?? card.status}</b> {card.title}</p>
      {prompt && <button type="button" className={`prompt${open ? ' open' : ''}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? prompt.slice(0, MAX_PROMPT) : prompt}</button>}
    </div>
  );
}

interface Props { cards: CanvasCard[]; prs: SessionPeek['prs']; sum: ActivitySummary; loaded: boolean }

export function BoxSection({ cards, prs, sum, loaded }: Props) {
  const files = sum.written.length + sum.edited.length;
  return (
    <section className="box" aria-label="Linked box">
      <h4>Box</h4>
      {!cards.length && !prs.length && !files && <p className="none">{loaded ? 'No box yet: no card, PR or file from this session.' : 'Loading…'}</p>}
      {cards.map((c) => <CardLine key={c.id} card={c} />)}
      {prs.map((p) => <p key={p.url}><a href={p.url} target="_blank" rel="noreferrer">{p.label}</a></p>)}
      {files > 0 && <p className="files">{sum.written.length} written · {sum.edited.length} edited</p>}
      {sum.written.slice(-6).map((f) => <p key={f} className="file" title={f}>+ {baseName(f)}</p>)}
    </section>
  );
}
