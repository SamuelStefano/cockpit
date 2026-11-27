export type SoundPack = 'off' | 'soft' | 'arcade';
export const SOUND_PACKS: SoundPack[] = ['off', 'soft', 'arcade'];

export class Audio {
  pack: SoundPack = 'off';
  private ctx: AudioContext | null = null;
  private timers = new Set<number>();

  beep(f = 660, d = 0.12, wave: OscillatorType = 'triangle', v = 0.12) {
    if (this.pack === 'off') return;
    this.ctx ??= new AudioContext();
    const c = this.ctx, o = c.createOscillator(), a = c.createGain();
    o.type = this.pack === 'arcade' ? 'square' : wave;
    o.frequency.value = f;
    a.gain.value = this.pack === 'arcade' ? v * 0.6 : v;
    a.gain.exponentialRampToValueAtTime(0.001, c.currentTime + d);
    o.connect(a).connect(c.destination);
    o.start();
    o.stop(c.currentTime + d);
  }

  chord(fs: number[]) {
    fs.forEach((f, i) => {
      const id = window.setTimeout(() => { this.timers.delete(id); this.beep(f, 0.22); }, i * 70);
      this.timers.add(id);
    });
  }

  dispose() {
    for (const id of this.timers) clearTimeout(id);
    this.timers.clear();
    void this.ctx?.close();
    this.ctx = null;
  }
}
