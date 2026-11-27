import { createContext, useContext, useEffect } from 'react';
import { safeHref } from '../../../lib/safe-href';
import { Skeleton } from '../Skeleton';

export type ResolvedImage = { status: 'loading' } | { status: 'error'; error: string } | { status: 'ok'; url: string };

// Resolver for `![alt](src)` injected by a view that can serve the file (a Equipe
// bot's thread serves its workspace). `null` = no provider: nothing is fetched,
// remote images included, and the image degrades to a link or its caption.
export interface ImageResolver {
  get: (src: string) => ResolvedImage | null;
  request: (src: string) => void;
}

export const ImageResolverContext = createContext<ImageResolver | null>(null);

const link = '[overflow-wrap:anywhere] text-orange-400 underline decoration-orange-400/40 underline-offset-2 transition hover:decoration-orange-400';

export function MdImage({ alt, src }: { alt: string; src: string }) {
  const resolver = useContext(ImageResolverContext);
  const got = resolver?.get(src) ?? null;
  useEffect(() => { if (resolver && !got) resolver.request(src); }, [resolver, got, src]);
  if (got?.status === 'ok') {
    return (
      <span className="my-2 block max-w-md">
        <img src={got.url} alt={alt} className="block max-h-96 rounded-xl border border-neutral-800 bg-white/5 object-contain" />
        {alt && <span className="mt-1 block text-[13px] text-neutral-500">{alt}</span>}
      </span>
    );
  }
  if (got?.status === 'loading') return <Skeleton inline className="my-2 h-40 w-72 rounded-xl" />;
  const href = /^https?:/i.test(src.trim()) ? safeHref(src) : undefined;
  if (href && !got) return <a href={href} target="_blank" rel="noreferrer" className={link}>{alt || src}</a>;
  return <span className="italic text-neutral-500">{alt || src}</span>;
}
