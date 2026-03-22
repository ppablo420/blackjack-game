/**
 * Synthesised sound effects using the Web Audio API — no external files needed.
 * AudioContext is created lazily on the first user gesture to comply with browser
 * autoplay policy.
 */
class SoundManager {
  private ctx: AudioContext | null = null;

  private get audio(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.ctx;
  }

  // ── Primitives ──────────────────────────────────────────────────────────────

  private tone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    vol = 0.28,
    startDelay = 0,
  ): void {
    const ctx  = this.audio;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type            = type;
    osc.frequency.value = freq;
    const t = ctx.currentTime + startDelay;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.start(t);
    osc.stop(t + duration + 0.01);
  }

  private noise(duration: number, vol = 0.35): void {
    const ctx    = this.audio;
    const frames = Math.floor(ctx.sampleRate * duration);
    const buf    = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data   = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.018));
    }
    const src  = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buf;
    gain.gain.value = vol;
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }

  // ── Public sounds ───────────────────────────────────────────────────────────

  /** Short percussive click — card landing on the table. */
  cardDeal(): void {
    this.noise(0.055, 0.38);
    this.tone(900, 0.04, 'triangle', 0.08);
  }

  /** Soft whoosh — card flip reveal. */
  flip(): void {
    this.noise(0.09, 0.22);
    this.tone(600, 0.07, 'sine', 0.06);
  }

  /** Crisp click — chip placed. */
  chipClick(): void {
    this.tone(1400, 0.06, 'square', 0.12);
    this.tone(900,  0.09, 'sine',   0.08, 0.02);
  }

  /** Ascending chime — win. */
  win(): void {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'sine', 0.22, i * 0.1));
  }

  /** Grand fanfare — blackjack! */
  blackjack(): void {
    [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.28, 'sine', 0.28, i * 0.08));
    this.tone(1047, 0.5, 'sine', 0.18, 0.45);
  }

  /** Descending tone — loss. */
  lose(): void {
    [392, 330, 277].forEach((f, i) => this.tone(f, 0.28, 'sine', 0.2, i * 0.13));
  }

  /** Neutral double-tap — push. */
  push(): void {
    this.tone(440, 0.14, 'sine', 0.15);
    this.tone(440, 0.14, 'sine', 0.15, 0.2);
  }

  /** Subtle button press. */
  buttonClick(): void {
    this.tone(800, 0.05, 'triangle', 0.1);
  }
}

export const sounds = new SoundManager();
