import { useMemo } from 'react';
import { CodeBlock } from '../CodeBlock';
import { DeckPanel } from './DeckPanel';
import { parsePanel } from './parse-panel';

export function DeckPanelBlock({ code }: { code: string }) {
  const data = useMemo(() => parsePanel(code), [code]);
  return data ? <DeckPanel data={data} /> : <CodeBlock code={code} lang="json" />;
}
