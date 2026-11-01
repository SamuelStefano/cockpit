import type { ReactNode } from 'react';
import type { FeedView } from '../activityView';
import { isNewSince } from '../seenStore';
import { FeedRow } from './FeedRow';
import { FileHistory } from './FileHistory';

interface Props {
  view: FeedView;
  loaded: boolean;
  open: ReadonlySet<string>;
  onToggle: (id: string) => void;
  seenAt: number | undefined;
  sessionRunning: boolean;
}

export function FeedList({ view, loaded, open, onToggle, seenAt, sessionRunning }: Props) {
  if (!loaded) return <li className="none">Loading activity…</li>;
  if (view.groups) return <FileHistory groups={view.groups} open={open} onToggle={onToggle} seenAt={seenAt} />;
  if (!view.rows.length) return <li className="none">Nothing here yet.</li>;
  let turn: number | null = null;
  return (
    <>
      {view.rows.map((it) => {
        const head = it.turn !== turn;
        turn = it.turn;
        return (
          <FeedItem key={it.id} head={head ? `${view.turnLabels.get(it.turn) ?? ''}${view.partialTurn === it.turn ? ' · partial' : ''}` : null}>
            <FeedRow item={it} open={open.has(it.id)} onToggle={onToggle} isNew={isNewSince(seenAt, it.ts)} sessionRunning={sessionRunning} />
          </FeedItem>
        );
      })}
    </>
  );
}

function FeedItem({ head, children }: { head: string | null; children: ReactNode }) {
  return (<>{head !== null && <li className="turn" role="separator">{head}</li>}{children}</>);
}
