const RATIO = 0.75;

let width = 0;
let tallest = 0;

// innerHeight alone is not a stable reference: iOS Safari can report it already shrunk
// with the keyboard up, and then the ratio never fires and the composer stays behind the
// keyboard. The tallest viewport seen at this width survives that; rotation resets it.
export function viewportShrunk(visible: number, inner: number, currentWidth: number): boolean {
  if (currentWidth !== width) { width = currentWidth; tallest = 0; }
  tallest = Math.max(tallest, inner, visible);
  return visible < tallest * RATIO;
}

export function resetViewportBaseline() {
  width = 0;
  tallest = 0;
}
