import { useEffect, useMemo, useState, type RefObject } from 'react';
import type { Message } from '../../data/types';
import { chatTopics, activeTopicIndex, TOPICS_MIN, type ChatTopic } from './chat-topics';

interface UseChatTopics {
  topics: ChatTopic[];
  activeId: string | null;
  open: boolean;
  setOpen: (v: boolean) => void;
  jumpTo: (id: string) => void;
}

const node = (root: HTMLElement, id: string) => root.querySelector<HTMLElement>(`[data-mid="${CSS.escape(id)}"]`);

export function useChatTopics(scrollRef: RefObject<HTMLDivElement | null>, messages: Message[]): UseChatTopics {
  const computed = useMemo(() => chatTopics(messages), [messages]);
  // `messages` changes on every streamed delta, but topics come from the user
  // prompts only. Keep the same array while the topic list is unchanged, so the
  // measuring effect below isn't torn down and re-run (a querySelector plus a
  // layout read per topic) dozens of times a second while a turn streams.
  const key = computed.map((t) => `${t.id}\u0000${t.title}`).join('\u0001');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const topics = useMemo(() => computed, [key]);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);

  // Segue a rolagem sem re-render por pixel: uma leitura de geometria por frame.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || topics.length < TOPICS_MIN) return;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const rootTop = el.getBoundingClientRect().top;
      const tops = topics.map((t) => { const n = node(el, t.id); return n ? n.getBoundingClientRect().top - rootTop + el.scrollTop : Infinity; });
      setActive(activeTopicIndex(tops, el.scrollTop));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(measure); };
    measure();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { el.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [scrollRef, topics]);

  const jumpTo = (id: string) => {
    const el = scrollRef.current;
    if (!el) return;
    node(el, id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setOpen(false);
  };

  return { topics: topics.length >= TOPICS_MIN ? topics : [], activeId: topics[active]?.id ?? null, open, setOpen, jumpTo };
}
