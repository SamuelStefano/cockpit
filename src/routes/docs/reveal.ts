// Scroll position that brings an item fully into a scroller's view, moving as
// little as possible (the "nearest" rule). Positions are along one axis, in the
// scroller's content coordinates. Returns `scroll` unchanged when it already fits.
export function nearestScroll(scroll: number, view: number, itemStart: number, itemSize: number, pad = 8): number {
  const start = itemStart - pad;
  const end = itemStart + itemSize + pad;
  if (start < scroll) return Math.max(0, start);
  if (end > scroll + view) return Math.max(0, Math.min(start, end - view));
  return scroll;
}

// Keeps the active entry of a nav list visible inside its own scroller, without
// touching any other scroller (scrollIntoView would also scroll the page and could
// cut the content's smooth scroll short).
export function revealIn(scroller: HTMLElement | null, selector: string, axis: 'x' | 'y'): void {
  const item = scroller?.querySelector<HTMLElement>(selector);
  if (!scroller || !item) return;
  const s = scroller.getBoundingClientRect();
  const r = item.getBoundingClientRect();
  if (axis === 'y') {
    const top = nearestScroll(scroller.scrollTop, scroller.clientHeight, r.top - s.top + scroller.scrollTop, r.height);
    if (top !== scroller.scrollTop) scroller.scrollTo({ top, behavior: 'smooth' });
  } else {
    const left = nearestScroll(scroller.scrollLeft, scroller.clientWidth, r.left - s.left + scroller.scrollLeft, r.width);
    if (left !== scroller.scrollLeft) scroller.scrollTo({ left, behavior: 'smooth' });
  }
}
