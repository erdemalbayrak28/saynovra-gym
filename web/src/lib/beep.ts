// Short confirmation tones for the gate. Audio is a nicety: any failure is ignored.
let context: AudioContext | null = null;

const TONES = {
  ok: { frequencies: [880, 1320], wave: 'sine' },
  bad: { frequencies: [240, 190], wave: 'square' },
} as const;

export function beep(kind: keyof typeof TONES): void {
  try {
    context ??= new AudioContext();
    const ctx = context;
    const tone = TONES[kind];
    tone.frequencies.forEach((frequency, i) => {
      const start = ctx.currentTime + i * 0.13;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = tone.wave;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.13);
    });
  } catch {
    // See note above.
  }
}
