// Scribe keeps re-sending the open segment, so text already handled at reset() would
// come back with the next partial. `consumed` strips it until that segment commits.
export class ScribeTranscript {
  private committed = '';
  private partial = '';
  private consumed = '';

  private fresh(text: string): string {
    return this.consumed && text.startsWith(this.consumed) ? text.slice(this.consumed.length) : text;
  }

  onPartial(text: string): string {
    this.partial = this.fresh(text);
    return this.current();
  }

  onCommit(text: string): string {
    const piece = this.fresh(text).trim();
    if (piece) this.committed = this.committed ? `${this.committed} ${piece}` : piece;
    this.partial = '';
    this.consumed = '';
    return this.current();
  }

  reset() {
    this.consumed += this.partial;
    this.committed = '';
    this.partial = '';
  }

  private current(): string {
    return `${this.committed} ${this.partial}`.trim();
  }
}

// Averaging is enough for speech and keeps this free of a resampler dependency.
export function toPcm16(input: Float32Array, inputRate: number, outputRate = 16000): Int16Array {
  const ratio = Math.max(1, inputRate / outputRate);
  const out = new Int16Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const from = Math.floor(i * ratio);
    const to = Math.max(from + 1, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = from; j < to; j++) sum += input[j];
    const sample = Math.max(-1, Math.min(1, sum / (to - from)));
    out[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return out;
}
