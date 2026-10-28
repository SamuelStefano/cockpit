import { EmptyState, Markdown, CodeBlock } from '../primitives';
import type { SharedBlock, SharedMessage } from '../../lib/share';
import { useSharedConversation } from './useSharedConversation';

function Block({ b }: { b: SharedBlock }) {
  if (b.type === 'text') return <Markdown md={b.md} />;
  if (b.type === 'code') return <CodeBlock code={b.code} lang={b.lang} />;
  return <div className="truncate rounded-md bg-neutral-900 px-2.5 py-1 font-mono text-[12px] text-neutral-400">$ {b.label}</div>;
}

function Row({ m }: { m: SharedMessage }) {
  if (m.role === 'compact') return <div className="py-2 text-center text-[12px] text-neutral-500">Conversa compactada</div>;
  if (m.role === 'user') {
    return (
      <div className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl bg-neutral-800 px-3.5 py-2 text-[14px] text-neutral-100">
        {m.text}
      </div>
    );
  }
  return <div className="space-y-2">{m.blocks.map((b, i) => <Block key={i} b={b} />)}</div>;
}

export default function SharedConversationView({ pathname }: { pathname: string }) {
  const state = useSharedConversation(pathname);
  if (state.status === 'loading') return <div className="min-h-dvh bg-neutral-950" />;
  if (state.status === 'invalid') {
    return (
      <div className="h-dvh bg-neutral-950">
        <EmptyState icon="link" title="Link inválido ou revogado" />
      </div>
    );
  }
  const { snap } = state;
  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 px-4 py-3">
        <h1 className="truncate text-[16px] font-bold">{snap.title}</h1>
        <p className="text-[12px] text-neutral-500">Compartilhado pelo Deck</p>
      </header>
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        {snap.messages.map((m, i) => <Row key={i} m={m} />)}
      </main>
    </div>
  );
}
